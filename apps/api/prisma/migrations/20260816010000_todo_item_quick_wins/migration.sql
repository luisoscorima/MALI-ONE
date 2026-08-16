-- AlterTable
ALTER TABLE "TodoItem" ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill sortOrder within each (ownerId, statusId) by createdAt
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "ownerId", "statusId"
      ORDER BY "createdAt" ASC, id ASC
    ) - 1 AS rn
  FROM "TodoItem"
)
UPDATE "TodoItem" AS t
SET "sortOrder" = ordered.rn
FROM ordered
WHERE t.id = ordered.id;

-- Backfill completedAt for items currently in a done status
UPDATE "TodoItem" AS t
SET "completedAt" = t."statusChangedAt"
FROM "TodoStatus" AS s
WHERE t."statusId" = s.id
  AND s."isDone" = true
  AND t."completedAt" IS NULL;

-- CreateIndex
CREATE INDEX "TodoItem_ownerId_statusId_idx" ON "TodoItem"("ownerId", "statusId");

-- CreateIndex
CREATE INDEX "TodoItem_ownerId_dueAt_idx" ON "TodoItem"("ownerId", "dueAt");

-- CreateIndex
CREATE INDEX "TodoItem_ownerId_archivedAt_idx" ON "TodoItem"("ownerId", "archivedAt");
