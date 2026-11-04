CREATE TABLE "TreasuryPaymentImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" "TreasuryProvider" NOT NULL,
  "origin" VARCHAR(32) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdCount" INTEGER NOT NULL,
  "updatedCount" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "TreasuryPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "provider" "TreasuryProvider" NOT NULL,
  "merchantCode" VARCHAR(64) NOT NULL,
  "merchantName" VARCHAR(200) NOT NULL,
  "transactionCode" VARCHAR(100) NOT NULL,
  "orderNumber" VARCHAR(100) NOT NULL,
  "customerName" VARCHAR(250) NOT NULL,
  "currency" "TreasuryCurrency" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" VARCHAR(80) NOT NULL,
  "transactedAt" TIMESTAMP(3) NOT NULL,
  "settledOn" DATE,
  "lastImportId" TEXT NOT NULL REFERENCES "TreasuryPaymentImport"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TreasuryPayment_nonnegative_amount" CHECK ("amount" >= 0)
);
CREATE UNIQUE INDEX "TreasuryPayment_provider_merchantCode_transactionCode_key" ON "TreasuryPayment"("provider", "merchantCode", "transactionCode");
CREATE INDEX "TreasuryPayment_transactedAt_id_idx" ON "TreasuryPayment"("transactedAt", "id");
CREATE INDEX "TreasuryPayment_merchantCode_status_idx" ON "TreasuryPayment"("merchantCode", "status");
CREATE INDEX "TreasuryPaymentImport_createdAt_idx" ON "TreasuryPaymentImport"("createdAt");
