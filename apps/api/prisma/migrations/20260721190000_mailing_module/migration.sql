-- AlterEnum
ALTER TYPE "AppModule" ADD VALUE 'mailing';

-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('draft', 'published');
CREATE TYPE "EmailCampaignStatus" AS ENUM ('draft', 'queued', 'sending', 'completed', 'failed');
CREATE TYPE "EmailSendStatus" AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE "EmailEventType" AS ENUM ('open', 'click');

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailCampaign" (
    "id" TEXT NOT NULL,
    "newsletterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'draft',
    "audienceArea" TEXT NOT NULL DEFAULT 'pam',
    "audienceSegment" TEXT,
    "audienceAttrKey" TEXT,
    "audienceAttrValue" TEXT,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactId" INTEGER,
    "name" TEXT,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'pending',
    "openToken" TEXT NOT NULL,
    "sesMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sendId" TEXT,
    "type" "EmailEventType" NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Newsletter_slug_key" ON "Newsletter"("slug");
CREATE INDEX "Newsletter_createdById_idx" ON "Newsletter"("createdById");
CREATE INDEX "Newsletter_status_idx" ON "Newsletter"("status");

CREATE INDEX "EmailCampaign_newsletterId_idx" ON "EmailCampaign"("newsletterId");
CREATE INDEX "EmailCampaign_createdById_idx" ON "EmailCampaign"("createdById");
CREATE INDEX "EmailCampaign_status_idx" ON "EmailCampaign"("status");

CREATE UNIQUE INDEX "EmailSend_openToken_key" ON "EmailSend"("openToken");
CREATE INDEX "EmailSend_campaignId_idx" ON "EmailSend"("campaignId");
CREATE INDEX "EmailSend_email_idx" ON "EmailSend"("email");

CREATE INDEX "EmailEvent_campaignId_createdAt_idx" ON "EmailEvent"("campaignId", "createdAt");
CREATE INDEX "EmailEvent_sendId_idx" ON "EmailEvent"("sendId");
CREATE INDEX "EmailEvent_type_idx" ON "EmailEvent"("type");

ALTER TABLE "Newsletter" ADD CONSTRAINT "Newsletter_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_newsletterId_fkey" FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailCampaign" ADD CONSTRAINT "EmailCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "EmailSend"("id") ON DELETE SET NULL ON UPDATE CASCADE;
