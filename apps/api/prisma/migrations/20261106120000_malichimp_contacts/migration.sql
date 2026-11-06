ALTER TYPE "AppModule" ADD VALUE 'malichimp';

CREATE TYPE "MalichimpContactStatus" AS ENUM (
  'subscribed',
  'unsubscribed',
  'cleaned',
  'nonsubscribed'
);

CREATE TYPE "MalichimpSuppressionReason" AS ENUM (
  'mailchimp_unsubscribed',
  'mailchimp_cleaned',
  'ses_bounce',
  'ses_complaint',
  'manual'
);

CREATE TABLE "MalichimpContact" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "firstName" VARCHAR(160),
  "lastName" VARCHAR(160),
  "phone" VARCHAR(80),
  "institutionName" VARCHAR(300),
  "jobTitle" VARCHAR(200),
  "city" VARCHAR(160),
  "country" VARCHAR(120),
  "classification" VARCHAR(160),
  "source" VARCHAR(240),
  "status" "MalichimpContactStatus" NOT NULL,
  "optInAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "statusChangedAt" TIMESTAMP(3),
  "attributes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MalichimpContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MalichimpTag" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "normalizedName" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MalichimpTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MalichimpContactTag" (
  "contactId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MalichimpContactTag_pkey" PRIMARY KEY ("contactId", "tagId")
);

CREATE TABLE "MalichimpSuppression" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "reason" "MalichimpSuppressionReason" NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "occurredAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MalichimpSuppression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MalichimpImportRun" (
  "id" TEXT NOT NULL,
  "sourceKey" VARCHAR(160) NOT NULL,
  "sourceDirectory" VARCHAR(500) NOT NULL,
  "fileFingerprint" VARCHAR(64) NOT NULL,
  "counts" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "MalichimpImportRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MalichimpContact_email_key" ON "MalichimpContact"("email");
CREATE INDEX "MalichimpContact_status_idx" ON "MalichimpContact"("status");
CREATE INDEX "MalichimpContact_lastName_firstName_idx" ON "MalichimpContact"("lastName", "firstName");
CREATE INDEX "MalichimpContact_updatedAt_idx" ON "MalichimpContact"("updatedAt");
CREATE UNIQUE INDEX "MalichimpTag_normalizedName_key" ON "MalichimpTag"("normalizedName");
CREATE INDEX "MalichimpTag_name_idx" ON "MalichimpTag"("name");
CREATE INDEX "MalichimpContactTag_tagId_idx" ON "MalichimpContactTag"("tagId");
CREATE UNIQUE INDEX "MalichimpSuppression_email_key" ON "MalichimpSuppression"("email");
CREATE INDEX "MalichimpSuppression_reason_idx" ON "MalichimpSuppression"("reason");
CREATE INDEX "MalichimpSuppression_updatedAt_idx" ON "MalichimpSuppression"("updatedAt");
CREATE INDEX "MalichimpImportRun_sourceKey_startedAt_idx" ON "MalichimpImportRun"("sourceKey", "startedAt");
CREATE INDEX "MalichimpImportRun_fileFingerprint_idx" ON "MalichimpImportRun"("fileFingerprint");

ALTER TABLE "MalichimpContactTag"
  ADD CONSTRAINT "MalichimpContactTag_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "MalichimpContact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MalichimpContactTag"
  ADD CONSTRAINT "MalichimpContactTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "MalichimpTag"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
