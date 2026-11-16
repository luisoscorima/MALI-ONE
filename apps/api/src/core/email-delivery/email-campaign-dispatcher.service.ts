import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { EmailCampaignStatus, EmailSendStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailDeliveryService } from './email-delivery.service';
import { EmailTrackingService } from './email-tracking.service';

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3;
const CLAIM_TTL_MS = 15 * 60 * 1000;

/** Durable, module-agnostic campaign dispatcher. Audience modules only enqueue snapshots. */
@Injectable()
export class EmailCampaignDispatcherService {
  private readonly logger = new Logger(EmailCampaignDispatcherService.name);
  private processing = false;
  private readonly delayMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: EmailDeliveryService,
    private readonly tracking: EmailTrackingService,
    config: ConfigService,
  ) {
    const rate = Math.max(1, Math.min(50, Number(config.get('SES_SEND_RATE_PER_SECOND')) || 8));
    this.delayMs = Math.ceil(1_000 / rate);
  }

  @Cron('*/5 * * * * *')
  async processQueue() {
    if (this.processing || !this.delivery.status.configured) return;
    this.processing = true;
    try {
      const now = new Date();
      await this.prisma.emailCampaign.updateMany({
        where: {
          managedByDispatcher: true,
          status: EmailCampaignStatus.scheduled,
          scheduledAt: { lte: now },
        },
        data: { status: EmailCampaignStatus.queued },
      });

      const campaign = await this.prisma.emailCampaign.findFirst({
        where: {
          managedByDispatcher: true,
          status: { in: [EmailCampaignStatus.queued, EmailCampaignStatus.sending] },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!campaign) return;

      if (campaign.status === EmailCampaignStatus.queued) {
        await this.prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: EmailCampaignStatus.queued },
          data: { status: EmailCampaignStatus.sending, startedAt: now },
        });
      }

      const staleClaim = new Date(Date.now() - CLAIM_TTL_MS);
      const candidates = await this.prisma.emailSend.findMany({
        where: {
          campaignId: campaign.id,
          status: EmailSendStatus.pending,
          AND: [
            { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
            { OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaim } }] },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
      });

      for (const candidate of candidates) {
        const claimed = await this.prisma.emailSend.updateMany({
          where: {
            id: candidate.id,
            status: EmailSendStatus.pending,
            OR: [{ claimedAt: null }, { claimedAt: { lt: staleClaim } }],
          },
          data: { claimedAt: new Date(), attemptCount: { increment: 1 } },
        });
        if (!claimed.count) continue;

        const send = await this.prisma.emailSend.findUniqueOrThrow({
          where: { id: candidate.id },
        });
        const globalSuppression = await this.prisma.emailGlobalSuppression.findUnique({
          where: { email: send.email },
          select: { reason: true },
        });
        if (globalSuppression) {
          await this.prisma.emailSend.update({
            where: { id: send.id },
            data: {
              status: EmailSendStatus.suppressed,
              claimedAt: null,
              error: `Suprimido globalmente: ${globalSuppression.reason}`,
            },
          });
          continue;
        }
        try {
          const unsubscribeUrl = campaign.unsubscribePath
            ? this.tracking.publicUrl(`${campaign.unsubscribePath}/${send.openToken}`)
            : undefined;
          const result = await this.delivery.sendHtml({
            to: send.email,
            subject: campaign.subjectSnapshot,
            html: this.tracking.inject(
              campaign.htmlSnapshot,
              send.openToken,
              unsubscribeUrl,
            ),
            fromName: campaign.fromName ?? undefined,
            fromEmail: campaign.fromEmail ?? undefined,
            replyTo: campaign.replyToEmail ?? undefined,
            tags: {
              source: campaign.audienceArea,
              campaign: campaign.id,
              send: send.id,
            },
          });
          await this.prisma.$transaction([
            this.prisma.emailSend.update({
              where: { id: send.id },
              data: {
                status: EmailSendStatus.sent,
                sesMessageId: result.messageId,
                sentAt: new Date(),
                claimedAt: null,
                nextAttemptAt: null,
                error: null,
              },
            }),
            this.prisma.emailCampaign.update({
              where: { id: campaign.id },
              data: { sentCount: { increment: 1 } },
            }),
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error de envío';
          const exhausted = send.attemptCount >= MAX_ATTEMPTS;
          await this.prisma.$transaction([
            this.prisma.emailSend.update({
              where: { id: send.id },
              data: {
                status: exhausted ? EmailSendStatus.failed : EmailSendStatus.pending,
                claimedAt: null,
                nextAttemptAt: exhausted
                  ? null
                  : new Date(Date.now() + send.attemptCount * 60_000),
                error: message.slice(0, 1000),
              },
            }),
            ...(exhausted
              ? [
                  this.prisma.emailCampaign.update({
                    where: { id: campaign.id },
                    data: { errorCount: { increment: 1 } },
                  }),
                ]
              : []),
          ]);
          this.logger.error(
            `No se pudo enviar ${send.id} (intento ${send.attemptCount}/${MAX_ATTEMPTS}): ${message}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }

      const remaining = await this.prisma.emailSend.count({
        where: { campaignId: campaign.id, status: EmailSendStatus.pending },
      });
      if (!remaining) {
        await this.prisma.emailCampaign.updateMany({
          where: {
            id: campaign.id,
            status: { in: [EmailCampaignStatus.queued, EmailCampaignStatus.sending] },
          },
          data: { status: EmailCampaignStatus.completed, completedAt: new Date() },
        });
      }
    } finally {
      this.processing = false;
    }
  }
}
