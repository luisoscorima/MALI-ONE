-- AlterTable
ALTER TABLE "EmailSend" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "EmailSend_campaignId_isTest_idx" ON "EmailSend"("campaignId", "isTest");
