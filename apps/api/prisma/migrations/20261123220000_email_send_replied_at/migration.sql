-- AlterTable
ALTER TABLE "EmailSend" ADD COLUMN "repliedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailSend_repliedAt_idx" ON "EmailSend"("repliedAt");
