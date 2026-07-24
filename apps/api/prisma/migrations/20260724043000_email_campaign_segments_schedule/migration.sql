-- AlterEnum
ALTER TYPE "EmailCampaignStatus" ADD VALUE 'scheduled';

-- AlterTable
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "audienceSegments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "audienceExcludeSegments" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

-- Backfill singular segment into array
UPDATE "EmailCampaign"
SET "audienceSegments" = ARRAY["audienceSegment"]
WHERE "audienceSegment" IS NOT NULL
  AND "audienceSegment" <> ''
  AND cardinality(COALESCE("audienceSegments", ARRAY[]::TEXT[])) = 0;

CREATE INDEX IF NOT EXISTS "EmailCampaign_scheduledAt_idx" ON "EmailCampaign"("scheduledAt");
