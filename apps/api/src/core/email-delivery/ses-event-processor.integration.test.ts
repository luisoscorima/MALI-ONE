import assert from 'node:assert/strict';
import test from 'node:test';
import { MalichimpSuppressionReason, SesEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SesEventProcessorService } from './ses-event-processor.service';

const databaseUrl = process.env.SES_EVENT_TEST_DATABASE_URL;

function event(
  id: string,
  detailType: string,
  email: string,
  extra: Record<string, unknown> = {},
) {
  return {
    version: '0',
    id,
    source: 'aws.ses',
    'detail-type': detailType,
    time: '2026-11-09T18:00:00.000Z',
    detail: {
      mail: {
        messageId: `message-${id}`,
        destination: [email],
      },
      ...extra,
    },
  };
}

test(
  'persists SES events idempotently and protects stronger suppressions',
  { skip: databaseUrl ? false : 'SES_EVENT_TEST_DATABASE_URL no configurada' },
  async () => {
    process.env.DATABASE_URL = databaseUrl;
    const prisma = new PrismaService();
    const processor = new SesEventProcessorService(prisma);
    await prisma.$connect();

    try {
      await prisma.sesEventRecord.deleteMany();
      await prisma.malichimpSuppression.deleteMany();

      const bounce = event('bounce-1', 'Email Bounced', 'Person@Example.com', {
        bounce: {
          bouncedRecipients: [{ emailAddress: 'person@example.com' }],
        },
      });
      await processor.process(bounce);
      await processor.process(bounce);

      assert.equal(await prisma.sesEventRecord.count(), 1);
      assert.equal(
        (await prisma.sesEventRecord.findFirstOrThrow()).type,
        SesEventType.bounce,
      );
      assert.equal(
        (await prisma.malichimpSuppression.findUniqueOrThrow({
          where: { email: 'person@example.com' },
        })).reason,
        MalichimpSuppressionReason.ses_bounce,
      );

      await processor.process(
        event('unsubscribe-1', 'Email Subscribed', 'optout@example.com', {
          subscription: { newTopicPreferences: { unsubscribeAll: true } },
        }),
      );
      assert.equal(
        (await prisma.malichimpSuppression.findUniqueOrThrow({
          where: { email: 'optout@example.com' },
        })).reason,
        MalichimpSuppressionReason.ses_unsubscribe,
      );

      await processor.process(
        event('optin-1', 'Email Subscribed', 'optout@example.com', {
          subscription: { newTopicPreferences: { unsubscribeAll: false } },
        }),
      );
      assert.equal(
        await prisma.malichimpSuppression.count({
          where: { email: 'optout@example.com' },
        }),
        0,
      );

      await prisma.malichimpSuppression.create({
        data: {
          email: 'protected@example.com',
          reason: MalichimpSuppressionReason.mailchimp_cleaned,
          source: 'mailchimp_export',
        },
      });
      await processor.process(
        event('optin-2', 'Email Subscribed', 'protected@example.com', {
          subscription: { newTopicPreferences: { unsubscribeAll: false } },
        }),
      );
      assert.equal(
        (await prisma.malichimpSuppression.findUniqueOrThrow({
          where: { email: 'protected@example.com' },
        })).reason,
        MalichimpSuppressionReason.mailchimp_cleaned,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
