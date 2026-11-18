-- CreateTable
CREATE TABLE "EducacionPerson" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "lastName" TEXT,
    "waContactId" INTEGER,

    CONSTRAINT "EducacionPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionOpportunity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "stageSlug" TEXT NOT NULL DEFAULT 'por_contactar',
    "advisorEmail" TEXT,
    "cameWithInbound" BOOLEAN NOT NULL DEFAULT false,
    "waCycleId" INTEGER,
    "waContactId" INTEGER,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "lastInteractionAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "sourceLabel" TEXT,
    "payload" JSONB,

    CONSTRAINT "EducacionOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionProspectiaCursor" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPolledAt" TIMESTAMP(3),
    "lastPage" INTEGER NOT NULL DEFAULT 0,
    "lastSeenExternalId" TEXT,
    "lastRunStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "processedTotal" INTEGER NOT NULL DEFAULT 0,
    "lastRunCreated" INTEGER NOT NULL DEFAULT 0,
    "lastRunUpdated" INTEGER NOT NULL DEFAULT 0,
    "lastRunSkipped" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EducacionProspectiaCursor_pkey" PRIMARY KEY ("id")
);

-- AlterTable EducacionCrmActivity
ALTER TABLE "EducacionCrmActivity" ALTER COLUMN "waCycleId" DROP NOT NULL;
ALTER TABLE "EducacionCrmActivity" ADD COLUMN "opportunityId" TEXT;

-- AlterTable EducacionSale
ALTER TABLE "EducacionSale" ALTER COLUMN "waCycleId" DROP NOT NULL;
ALTER TABLE "EducacionSale" ADD COLUMN "opportunityId" TEXT;

-- CreateIndex
CREATE INDEX "EducacionPerson_phone_idx" ON "EducacionPerson"("phone");
CREATE INDEX "EducacionPerson_email_idx" ON "EducacionPerson"("email");
CREATE INDEX "EducacionPerson_waContactId_idx" ON "EducacionPerson"("waContactId");

CREATE UNIQUE INDEX "EducacionOpportunity_channel_externalId_key" ON "EducacionOpportunity"("channel", "externalId");
CREATE INDEX "EducacionOpportunity_waCycleId_idx" ON "EducacionOpportunity"("waCycleId");
CREATE INDEX "EducacionOpportunity_waContactId_idx" ON "EducacionOpportunity"("waContactId");
CREATE INDEX "EducacionOpportunity_cameWithInbound_closedAt_idx" ON "EducacionOpportunity"("cameWithInbound", "closedAt");
CREATE INDEX "EducacionOpportunity_category_createdAt_idx" ON "EducacionOpportunity"("category", "createdAt");
CREATE INDEX "EducacionOpportunity_advisorEmail_idx" ON "EducacionOpportunity"("advisorEmail");
CREATE INDEX "EducacionOpportunity_channel_createdAt_idx" ON "EducacionOpportunity"("channel", "createdAt");

CREATE INDEX "EducacionCrmActivity_opportunityId_occurredAt_idx" ON "EducacionCrmActivity"("opportunityId", "occurredAt");
CREATE UNIQUE INDEX "EducacionSale_opportunityId_key" ON "EducacionSale"("opportunityId");

-- AddForeignKey
ALTER TABLE "EducacionOpportunity" ADD CONSTRAINT "EducacionOpportunity_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "EducacionPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducacionCrmActivity" ADD CONSTRAINT "EducacionCrmActivity_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "EducacionOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EducacionSale" ADD CONSTRAINT "EducacionSale_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "EducacionOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
