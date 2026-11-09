-- AlterEnum
ALTER TYPE "MalichimpSuppressionReason" ADD VALUE IF NOT EXISTS 'ses_unsubscribe';

-- CreateEnum
CREATE TYPE "SesEventType" AS ENUM (
  'send',
  'rendering_failure',
  'reject',
  'delivery',
  'bounce',
  'complaint',
  'delivery_delay',
  'subscription',
  'open',
  'click'
);

-- CreateTable
CREATE TABLE "SesEventRecord" (
  "id" TEXT NOT NULL,
  "eventKey" VARCHAR(500) NOT NULL,
  "eventId" VARCHAR(120) NOT NULL,
  "messageId" VARCHAR(255),
  "type" "SesEventType" NOT NULL,
  "email" VARCHAR(320),
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SesEventRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SesEventRecord_eventKey_key" ON "SesEventRecord"("eventKey");
CREATE INDEX "SesEventRecord_eventId_idx" ON "SesEventRecord"("eventId");
CREATE INDEX "SesEventRecord_messageId_idx" ON "SesEventRecord"("messageId");
CREATE INDEX "SesEventRecord_email_occurredAt_idx" ON "SesEventRecord"("email", "occurredAt");
CREATE INDEX "SesEventRecord_type_occurredAt_idx" ON "SesEventRecord"("type", "occurredAt");
