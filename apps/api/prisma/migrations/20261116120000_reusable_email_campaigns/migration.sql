-- Shared provider-level suppressions. Audience-specific opt-outs stay in their module.
ALTER TYPE "MalichimpSuppressionReason" ADD VALUE IF NOT EXISTS 'malichimp_unsubscribe';
ALTER TYPE "EmailSendStatus" ADD VALUE IF NOT EXISTS 'suppressed';

CREATE TYPE "EmailGlobalSuppressionReason" AS ENUM ('bounce', 'complaint', 'unsubscribe', 'manual');

CREATE TABLE "EmailGlobalSuppression" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "reason" "EmailGlobalSuppressionReason" NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailGlobalSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailGlobalSuppression_email_key" ON "EmailGlobalSuppression"("email");
CREATE INDEX "EmailGlobalSuppression_reason_idx" ON "EmailGlobalSuppression"("reason");
CREATE INDEX "EmailGlobalSuppression_updatedAt_idx" ON "EmailGlobalSuppression"("updatedAt");

-- Move provider-owned legacy records out of the MALICHIMP domain table.
INSERT INTO "EmailGlobalSuppression" (
  "id", "email", "reason", "source", "occurredAt", "metadata", "createdAt", "updatedAt"
)
SELECT
  "id",
  "email",
  CASE
    WHEN "reason" = 'ses_bounce' THEN 'bounce'::"EmailGlobalSuppressionReason"
    WHEN "reason" = 'ses_complaint' THEN 'complaint'::"EmailGlobalSuppressionReason"
    ELSE 'unsubscribe'::"EmailGlobalSuppressionReason"
  END,
  "source",
  "occurredAt",
  "metadata",
  "createdAt",
  "updatedAt"
FROM "MalichimpSuppression"
WHERE "reason" IN ('ses_bounce', 'ses_complaint', 'ses_unsubscribe')
ON CONFLICT ("email") DO NOTHING;

DELETE FROM "MalichimpSuppression"
WHERE "reason" IN ('ses_bounce', 'ses_complaint', 'ses_unsubscribe');

-- Campaigns carry an immutable copy of the content they send.
ALTER TABLE "EmailCampaign"
  ADD COLUMN "subjectSnapshot" VARCHAR(300),
  ADD COLUMN "htmlSnapshot" TEXT,
  ADD COLUMN "fromName" VARCHAR(160),
  ADD COLUMN "fromEmail" VARCHAR(320),
  ADD COLUMN "unsubscribePath" VARCHAR(200),
  ADD COLUMN "managedByDispatcher" BOOLEAN NOT NULL DEFAULT false;

UPDATE "EmailCampaign" campaign
SET
  "subjectSnapshot" = newsletter."subject",
  "htmlSnapshot" = newsletter."htmlBody"
FROM "Newsletter" newsletter
WHERE newsletter."id" = campaign."newsletterId";

ALTER TABLE "EmailCampaign"
  ALTER COLUMN "subjectSnapshot" SET NOT NULL,
  ALTER COLUMN "htmlSnapshot" SET NOT NULL;

-- Preserve historical campaigns when a newsletter is removed.
ALTER TABLE "EmailCampaign" DROP CONSTRAINT "EmailCampaign_newsletterId_fkey";
ALTER TABLE "EmailCampaign"
  ADD CONSTRAINT "EmailCampaign_newsletterId_fkey"
  FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Delivery lifecycle fields used by the shared durable dispatcher and event projector.
ALTER TABLE "EmailSend"
  ADD COLUMN "sourceContactId" VARCHAR(120),
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "bouncedAt" TIMESTAMP(3),
  ADD COLUMN "complainedAt" TIMESTAMP(3),
  ADD COLUMN "openedAt" TIMESTAMP(3),
  ADD COLUMN "clickedAt" TIMESTAMP(3);

CREATE INDEX "EmailSend_status_nextAttemptAt_idx" ON "EmailSend"("status", "nextAttemptAt");
CREATE INDEX "EmailSend_sesMessageId_idx" ON "EmailSend"("sesMessageId");
