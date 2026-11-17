/**
 * Backfills EmailSend engagement timestamps from SesEventRecord + EmailEvent,
 * then rebuilds EmailCampaign openCount/clickCount.
 *
 *   pnpm --filter @mali-one/api exec tsx prisma/backfill-email-send-events.ts --dry-run
 *   pnpm --filter @mali-one/api exec tsx prisma/backfill-email-send-events.ts
 */
import { Prisma, PrismaClient, SesEventType } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

type CountRow = { count: bigint };

async function count(sql: Prisma.Sql): Promise<number> {
  const [row] = await prisma.$queryRaw<CountRow[]>(sql);
  return Number(row?.count ?? 0);
}

async function main() {
  const pending = {
    delivered: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.delivery}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) event ON event."messageId" = send."sesMessageId"
      WHERE send."deliveredAt" IS NULL
    `),
    bounced: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.bounce}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) event ON event."messageId" = send."sesMessageId"
      WHERE send."bouncedAt" IS NULL
    `),
    complained: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.complaint}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) event ON event."messageId" = send."sesMessageId"
      WHERE send."complainedAt" IS NULL
    `),
    openedFromSes: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.open}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) event ON event."messageId" = send."sesMessageId"
      WHERE send."openedAt" IS NULL
    `),
    clickedFromSes: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.click}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) event ON event."messageId" = send."sesMessageId"
      WHERE send."clickedAt" IS NULL
    `),
    openedFromPixel: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "sendId", MIN("createdAt") AS "firstAt"
        FROM "EmailEvent"
        WHERE "type" = 'open'::"EmailEventType"
          AND "sendId" IS NOT NULL
        GROUP BY "sendId"
      ) event ON event."sendId" = send."id"
      WHERE send."openedAt" IS NULL
    `),
    clickedFromPixel: await count(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "EmailSend" send
      JOIN (
        SELECT "sendId", MIN("createdAt") AS "firstAt"
        FROM "EmailEvent"
        WHERE "type" = 'click'::"EmailEventType"
          AND "sendId" IS NOT NULL
        GROUP BY "sendId"
      ) event ON event."sendId" = send."id"
      WHERE send."clickedAt" IS NULL
    `),
  };

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', pending }, null, 2));
  if (dryRun) return;

  const updated = {
    delivered: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "deliveredAt" = event."firstAt"
      FROM (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.delivery}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) AS event
      WHERE send."sesMessageId" = event."messageId"
        AND send."deliveredAt" IS NULL
    `),
    bounced: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "bouncedAt" = event."firstAt"
      FROM (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.bounce}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) AS event
      WHERE send."sesMessageId" = event."messageId"
        AND send."bouncedAt" IS NULL
    `),
    complained: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "complainedAt" = event."firstAt"
      FROM (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.complaint}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) AS event
      WHERE send."sesMessageId" = event."messageId"
        AND send."complainedAt" IS NULL
    `),
    openedFromSes: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "openedAt" = event."firstAt"
      FROM (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.open}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) AS event
      WHERE send."sesMessageId" = event."messageId"
        AND send."openedAt" IS NULL
    `),
    clickedFromSes: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "clickedAt" = event."firstAt"
      FROM (
        SELECT "messageId", MIN("occurredAt") AS "firstAt"
        FROM "SesEventRecord"
        WHERE "type" = ${SesEventType.click}::"SesEventType"
          AND "messageId" IS NOT NULL
        GROUP BY "messageId"
      ) AS event
      WHERE send."sesMessageId" = event."messageId"
        AND send."clickedAt" IS NULL
    `),
    openedFromPixel: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "openedAt" = event."firstAt"
      FROM (
        SELECT "sendId", MIN("createdAt") AS "firstAt"
        FROM "EmailEvent"
        WHERE "type" = 'open'::"EmailEventType"
          AND "sendId" IS NOT NULL
        GROUP BY "sendId"
      ) AS event
      WHERE send."id" = event."sendId"
        AND send."openedAt" IS NULL
    `),
    clickedFromPixel: await prisma.$executeRaw(Prisma.sql`
      UPDATE "EmailSend" AS send
      SET "clickedAt" = event."firstAt"
      FROM (
        SELECT "sendId", MIN("createdAt") AS "firstAt"
        FROM "EmailEvent"
        WHERE "type" = 'click'::"EmailEventType"
          AND "sendId" IS NOT NULL
        GROUP BY "sendId"
      ) AS event
      WHERE send."id" = event."sendId"
        AND send."clickedAt" IS NULL
    `),
  };

  const campaigns = await prisma.$executeRaw(Prisma.sql`
    UPDATE "EmailCampaign" AS campaign
    SET
      "openCount" = COALESCE(stats."opened", 0),
      "clickCount" = COALESCE(stats."clicked", 0)
    FROM (
      SELECT
        send."campaignId",
        COUNT(*) FILTER (WHERE send."openedAt" IS NOT NULL)::int AS opened,
        COUNT(*) FILTER (WHERE send."clickedAt" IS NOT NULL)::int AS clicked
      FROM "EmailSend" send
      GROUP BY send."campaignId"
    ) AS stats
    WHERE campaign."id" = stats."campaignId"
      AND (
        campaign."openCount" IS DISTINCT FROM COALESCE(stats."opened", 0)
        OR campaign."clickCount" IS DISTINCT FROM COALESCE(stats."clicked", 0)
      )
  `);

  console.log(JSON.stringify({ updated, campaignsRecounted: campaigns }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
