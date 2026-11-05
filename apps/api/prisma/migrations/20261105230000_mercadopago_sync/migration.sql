CREATE TABLE "MercadoPagoSyncState" (
    "sourceId" TEXT NOT NULL,
    "runId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "fromDate" TEXT,
    "toDate" TEXT,
    "errorCode" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MercadoPagoSyncState_pkey" PRIMARY KEY ("sourceId")
);

CREATE TABLE "MercadoPagoPayment" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "paymentId" VARCHAR(64) NOT NULL,
    "merchantOrderId" VARCHAR(64),
    "externalReference" VARCHAR(160),
    "description" VARCHAR(300),
    "status" VARCHAR(40) NOT NULL,
    "statusDetail" VARCHAR(80),
    "currency" "TreasuryCurrency" NOT NULL,
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "netAmount" DECIMAL(18,2),
    "feeAmount" DECIMAL(18,2),
    "paymentMethodId" VARCHAR(80),
    "paymentTypeId" VARCHAR(40),
    "issuerName" VARCHAR(120),
    "cardLastDigits" VARCHAR(8),
    "installments" INTEGER,
    "payerName" VARCHAR(250),
    "payerEmail" VARCHAR(250),
    "createdAtMp" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "lastUpdatedAtMp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MercadoPagoPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MercadoPagoPayment_sourceId_paymentId_key" ON "MercadoPagoPayment"("sourceId", "paymentId");
CREATE INDEX "MercadoPagoPayment_sourceId_createdAtMp_id_idx" ON "MercadoPagoPayment"("sourceId", "createdAtMp", "id");
CREATE INDEX "MercadoPagoPayment_sourceId_status_idx" ON "MercadoPagoPayment"("sourceId", "status");
ALTER TABLE "MercadoPagoSyncState" ADD CONSTRAINT "MercadoPagoSyncState_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "TreasurySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MercadoPagoPayment" ADD CONSTRAINT "MercadoPagoPayment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "TreasurySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
