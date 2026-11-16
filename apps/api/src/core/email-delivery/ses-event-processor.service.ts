import { Injectable } from '@nestjs/common';
import {
  EmailGlobalSuppressionReason,
  Prisma,
  SesEventType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseSesEvent } from './ses-event';

@Injectable()
export class SesEventProcessorService {
  constructor(private readonly prisma: PrismaService) {}

  async process(raw: unknown) {
    const event = parseSesEvent(raw);
    const recipients = event.recipients.length ? event.recipients : [null];

    await this.prisma.$transaction(async (tx) => {
      await tx.sesEventRecord.createMany({
        data: recipients.map((email) => ({
          eventKey: `${event.eventId}:${email ?? '-'}`,
          eventId: event.eventId,
          messageId: event.messageId,
          type: event.type,
          email,
          occurredAt: event.occurredAt,
          payload: event.payload as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });

      if (event.messageId) {
        const sends = await tx.emailSend.findMany({
          where: { sesMessageId: event.messageId },
          select: { id: true, campaignId: true },
        });
        for (const send of sends) {
          if (event.type === SesEventType.delivery) {
            await tx.emailSend.updateMany({
              where: { id: send.id, deliveredAt: null },
              data: { deliveredAt: event.occurredAt },
            });
          } else if (event.type === SesEventType.bounce) {
            await tx.emailSend.updateMany({
              where: { id: send.id, bouncedAt: null },
              data: { bouncedAt: event.occurredAt },
            });
          } else if (event.type === SesEventType.complaint) {
            await tx.emailSend.updateMany({
              where: { id: send.id, complainedAt: null },
              data: { complainedAt: event.occurredAt },
            });
          } else if (event.type === SesEventType.open) {
            const first = await tx.emailSend.updateMany({
              where: { id: send.id, openedAt: null },
              data: { openedAt: event.occurredAt },
            });
            if (first.count) {
              await tx.emailCampaign.update({
                where: { id: send.campaignId },
                data: { openCount: { increment: 1 } },
              });
            }
          } else if (event.type === SesEventType.click) {
            const first = await tx.emailSend.updateMany({
              where: { id: send.id, clickedAt: null },
              data: { clickedAt: event.occurredAt },
            });
            if (first.count) {
              await tx.emailCampaign.update({
                where: { id: send.campaignId },
                data: { clickCount: { increment: 1 } },
              });
            }
          }
        }
      }

      for (const email of event.recipients) {
        const reason = this.suppressionReason(event.type);
        if (reason) {
          const existing = await tx.emailGlobalSuppression.findUnique({
            where: { email },
          });
          if (existing?.reason !== EmailGlobalSuppressionReason.manual) {
            await tx.emailGlobalSuppression.upsert({
              where: { email },
              create: {
                email,
                reason,
                source: 'aws_ses_event',
                occurredAt: event.occurredAt,
                metadata: {
                  eventId: event.eventId,
                  messageId: event.messageId,
                  eventType: event.type,
                },
              },
              update: {
                reason,
                source: 'aws_ses_event',
                occurredAt: event.occurredAt,
                metadata: {
                  eventId: event.eventId,
                  messageId: event.messageId,
                  eventType: event.type,
                },
              },
            });
          }
        } else if (
          event.type === SesEventType.subscription &&
          event.subscriptionAction === 'suppress'
        ) {
          const existing = await tx.emailGlobalSuppression.findUnique({
            where: { email },
          });
          if (!existing || existing.reason === EmailGlobalSuppressionReason.unsubscribe) {
            await tx.emailGlobalSuppression.upsert({
              where: { email },
              create: {
                email,
                reason: EmailGlobalSuppressionReason.unsubscribe,
                source: 'aws_ses_subscription',
                occurredAt: event.occurredAt,
                metadata: { eventId: event.eventId, messageId: event.messageId },
              },
              update: {
                source: 'aws_ses_subscription',
                occurredAt: event.occurredAt,
                metadata: { eventId: event.eventId, messageId: event.messageId },
              },
            });
          }
        } else if (
          event.type === SesEventType.subscription &&
          event.subscriptionAction === 'restore'
        ) {
          await tx.emailGlobalSuppression.deleteMany({
            where: { email, reason: EmailGlobalSuppressionReason.unsubscribe },
          });
        }
      }
    });

    return event;
  }

  private suppressionReason(type: SesEventType) {
    if (type === SesEventType.bounce) return EmailGlobalSuppressionReason.bounce;
    if (type === SesEventType.complaint) {
      return EmailGlobalSuppressionReason.complaint;
    }
    return null;
  }
}
