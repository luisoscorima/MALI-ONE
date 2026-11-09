import { Injectable } from '@nestjs/common';
import {
  MalichimpSuppressionReason,
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

      for (const email of event.recipients) {
        const reason = this.suppressionReason(event.type);
        if (reason) {
          await tx.malichimpSuppression.upsert({
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
        } else if (
          event.type === SesEventType.subscription &&
          event.subscriptionAction === 'suppress'
        ) {
          await tx.malichimpSuppression.upsert({
            where: { email },
            create: {
              email,
              reason: MalichimpSuppressionReason.ses_unsubscribe,
              source: 'aws_ses_subscription',
              occurredAt: event.occurredAt,
              metadata: { eventId: event.eventId, messageId: event.messageId },
            },
            update: {
              reason: MalichimpSuppressionReason.ses_unsubscribe,
              source: 'aws_ses_subscription',
              occurredAt: event.occurredAt,
              metadata: { eventId: event.eventId, messageId: event.messageId },
            },
          });
        } else if (
          event.type === SesEventType.subscription &&
          event.subscriptionAction === 'restore'
        ) {
          await tx.malichimpSuppression.deleteMany({
            where: {
              email,
              reason: MalichimpSuppressionReason.ses_unsubscribe,
            },
          });
        }
      }
    });

    return event;
  }

  private suppressionReason(type: SesEventType) {
    if (type === SesEventType.bounce) {
      return MalichimpSuppressionReason.ses_bounce;
    }
    if (type === SesEventType.complaint) {
      return MalichimpSuppressionReason.ses_complaint;
    }
    return null;
  }
}
