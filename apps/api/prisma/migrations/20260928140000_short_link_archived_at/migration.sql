ALTER TABLE "ShortLink" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ShortLink_createdById_archivedAt_idx" ON "ShortLink"("createdById", "archivedAt");
