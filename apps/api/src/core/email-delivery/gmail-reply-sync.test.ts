import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  GmailReplySyncService,
  REPLY_SYNC_LOOKBACK_MS,
} from './gmail-reply-sync.service';

test('listReplyMailboxes watches recent sends regardless of campaign status', async () => {
  let capturedWhere: Record<string, unknown> | undefined;
  const prisma = {
    emailCampaign: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        capturedWhere = args.where;
        return [{ replyToEmail: 'comunicaciones+mc.token@mali.pe' }];
      },
    },
  } as unknown as PrismaService;

  const service = new GmailReplySyncService(
    { get: () => undefined } as unknown as ConfigService,
    prisma,
  );

  const mailboxes = await (
    service as unknown as { listReplyMailboxes: () => Promise<string[]> }
  ).listReplyMailboxes();

  assert.deepEqual(mailboxes, ['comunicaciones@mali.pe']);
  assert.equal(capturedWhere?.audienceArea, 'malichimp');
  assert.ok(!('status' in (capturedWhere ?? {})));
  const sends = capturedWhere?.sends as { some: { status: string; sentAt: { gte: Date } } };
  assert.equal(sends.some.status, 'sent');
  assert.ok(sends.some.sentAt.gte instanceof Date);
  const ageMs = Date.now() - sends.some.sentAt.gte.getTime();
  assert.ok(ageMs >= REPLY_SYNC_LOOKBACK_MS - 5_000);
  assert.ok(ageMs <= REPLY_SYNC_LOOKBACK_MS + 5_000);
});
