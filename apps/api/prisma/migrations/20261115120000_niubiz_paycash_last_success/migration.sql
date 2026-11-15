ALTER TABLE "NiubizPayCashSyncState"
  ADD COLUMN "lastSuccessfulAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessfulRowCount" INTEGER;

UPDATE "NiubizPayCashSyncState"
SET "lastSuccessfulAt" = "finishedAt",
    "lastSuccessfulRowCount" = "rowCount"
WHERE "status" = 'completed' AND "finishedAt" IS NOT NULL;
