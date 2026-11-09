import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmailCampaignStatus, EmailSendStatus, NewsletterStatus, SesEventType } from '@prisma/client';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GoogleAdminService } from '../google-admin/google-admin.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import { CreateInternalCampaignDto } from './dto/create-internal-campaign.dto';

const AUDIENCE_AREA = 'internal_workspace';
const MAX_RECIPIENTS = 200;

@Injectable()
export class InternalCommunicationsService {
  private readonly logger = new Logger(InternalCommunicationsService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAdmin: GoogleAdminService,
    private readonly newslettersService: NewslettersService,
    private readonly delivery: EmailDeliveryService,
  ) {}

  async audience(activeDays = 30) {
    const members = await this.googleAdmin.listRecentlyActiveInternalUsers(activeDays);
    return {
      members,
      activeDays,
      generatedAt: new Date().toISOString(),
      source: 'google_workspace_last_login' as const,
      note: `Cuentas @mali.pe habilitadas que iniciaron sesión en Google Workspace durante los últimos ${activeDays} días.`,
    };
  }

  newsletters() {
    return this.newslettersService.listPublished();
  }

  async createCampaign(userId: string, dto: CreateInternalCampaignDto) {
    const recipients = [...new Set(dto.recipients.map((email) => email.trim().toLowerCase()))];
    if (recipients.length > MAX_RECIPIENTS) {
      throw new BadRequestException(`El máximo por envío es ${MAX_RECIPIENTS}`);
    }
    if (recipients.some((email) => !email.endsWith('@mali.pe'))) {
      throw new BadRequestException('Comunicación Interna solo permite cuentas @mali.pe');
    }

    const audience = await this.googleAdmin.listRecentlyActiveInternalUsers(30);
    const eligible = new Map(audience.map((member) => [member.email, member]));
    const invalid = recipients.filter((email) => !eligible.has(email));
    if (invalid.length) {
      throw new BadRequestException(
        `${invalid.length} destinatario(s) ya no cumplen la regla de actividad de 30 días`,
      );
    }

    const newsletter = await this.prisma.newsletter.findFirst({
      where: { id: dto.newsletterId, status: NewsletterStatus.published },
      select: { id: true },
    });
    if (!newsletter) throw new BadRequestException('Selecciona un boletín publicado');

    return this.prisma.emailCampaign.create({
      data: {
        newsletterId: newsletter.id,
        name: dto.name.trim(),
        status: EmailCampaignStatus.queued,
        audienceArea: AUDIENCE_AREA,
        audienceSegments: ['google-workspace-active-30d'],
        totalRecipients: recipients.length,
        createdById: userId,
        sends: {
          create: recipients.map((email) => ({
            email,
            name: eligible.get(email)?.name || null,
          })),
        },
      },
      select: { id: true, status: true, totalRecipients: true },
    });
  }

  async campaigns() {
    const rows = await this.prisma.emailCampaign.findMany({
      where: { audienceArea: AUDIENCE_AREA },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        newsletter: { select: { title: true, subject: true } },
        sends: {
          select: {
            id: true,
            sesMessageId: true,
            status: true,
            events: { select: { type: true } },
          },
        },
      },
    });

    const messageIds = rows.flatMap((row) => row.sends.map((send) => send.sesMessageId).filter(Boolean)) as string[];
    const sesEvents = messageIds.length
      ? await this.prisma.sesEventRecord.findMany({
          where: { messageId: { in: messageIds } },
          select: { messageId: true, type: true },
        })
      : [];
    const byMessage = new Map<string, Set<SesEventType>>();
    for (const event of sesEvents) {
      if (!event.messageId) continue;
      const types = byMessage.get(event.messageId) ?? new Set<SesEventType>();
      types.add(event.type);
      byMessage.set(event.messageId, types);
    }

    return rows.map((row) => {
      let delivered = 0;
      let bounced = 0;
      let complaints = 0;
      let opened = 0;
      let clicked = 0;
      for (const send of row.sends) {
        const types = send.sesMessageId ? byMessage.get(send.sesMessageId) : undefined;
        if (types?.has(SesEventType.delivery)) delivered++;
        if (types?.has(SesEventType.bounce)) bounced++;
        if (types?.has(SesEventType.complaint)) complaints++;
        if (types?.has(SesEventType.open) || send.events.some((event) => event.type === 'open')) opened++;
        if (types?.has(SesEventType.click) || send.events.some((event) => event.type === 'click')) clicked++;
      }
      return {
        id: row.id,
        name: row.name,
        newsletterId: row.newsletterId,
        newsletterTitle: row.newsletter.title,
        subject: row.newsletter.subject,
        status: row.status,
        totalRecipients: row.totalRecipients,
        sent: row.sentCount,
        failed: row.errorCount,
        delivered,
        bounced,
        complaints,
        opened,
        clicked,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
      };
    });
  }

  @Cron('*/10 * * * * *')
  async processQueue() {
    if (this.processing || !this.delivery.status.configured) return;
    this.processing = true;
    try {
      const campaign = await this.prisma.emailCampaign.findFirst({
        where: {
          audienceArea: AUDIENCE_AREA,
          status: { in: [EmailCampaignStatus.queued, EmailCampaignStatus.sending] },
        },
        orderBy: { createdAt: 'asc' },
        include: { newsletter: true, sends: { where: { status: EmailSendStatus.pending }, orderBy: { createdAt: 'asc' } } },
      });
      if (!campaign) return;
      if (campaign.status === EmailCampaignStatus.queued) {
        await this.prisma.emailCampaign.update({
          where: { id: campaign.id },
          data: { status: EmailCampaignStatus.sending, startedAt: new Date() },
        });
      }

      for (const send of campaign.sends) {
        try {
          const html = this.newslettersService.injectTracking(campaign.newsletter.htmlBody, send.openToken);
          const result = await this.delivery.sendHtml({
            to: send.email,
            subject: campaign.newsletter.subject,
            html,
            fromName: 'MALI - Comunicacion Interna',
            tags: { campaign: campaign.id, send: send.id },
          });
          await this.prisma.$transaction([
            this.prisma.emailSend.update({
              where: { id: send.id },
              data: { status: EmailSendStatus.sent, sesMessageId: result.messageId, sentAt: new Date() },
            }),
            this.prisma.emailCampaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: 1 } } }),
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error de envío';
          await this.prisma.$transaction([
            this.prisma.emailSend.update({ where: { id: send.id }, data: { status: EmailSendStatus.failed, error: message.slice(0, 1000) } }),
            this.prisma.emailCampaign.update({ where: { id: campaign.id }, data: { errorCount: { increment: 1 } } }),
          ]);
          this.logger.error(`No se pudo enviar ${send.email}: ${message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await this.prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: EmailCampaignStatus.completed, completedAt: new Date() },
      });
    } finally {
      this.processing = false;
    }
  }
}
