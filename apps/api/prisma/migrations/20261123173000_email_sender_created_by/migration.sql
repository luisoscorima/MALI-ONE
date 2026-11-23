-- AlterTable
ALTER TABLE "EmailSender" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "EmailSender_createdById_idx" ON "EmailSender"("createdById");

-- AddForeignKey
ALTER TABLE "EmailSender" ADD CONSTRAINT "EmailSender_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
