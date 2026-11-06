CREATE TABLE "PagoEfectivoSyncState" (
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
    CONSTRAINT "PagoEfectivoSyncState_pkey" PRIMARY KEY ("sourceId")
);

CREATE TABLE "PagoEfectivoPayment" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "transactionId" VARCHAR(100) NOT NULL,
    "cip" VARCHAR(80),
    "externalReference" VARCHAR(160),
    "description" VARCHAR(300),
    "status" VARCHAR(60) NOT NULL,
    "currency" "TreasuryCurrency" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "feeAmount" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2),
    "payerName" VARCHAR(250),
    "payerEmail" VARCHAR(250),
    "paymentChannel" VARCHAR(100),
    "financialEntity" VARCHAR(120),
    "createdAtPe" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "lastUpdatedAtPe" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PagoEfectivoPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PagoEfectivoPayment_sourceId_transactionId_key" ON "PagoEfectivoPayment"("sourceId", "transactionId");
CREATE INDEX "PagoEfectivoPayment_sourceId_createdAtPe_id_idx" ON "PagoEfectivoPayment"("sourceId", "createdAtPe", "id");
CREATE INDEX "PagoEfectivoPayment_sourceId_status_idx" ON "PagoEfectivoPayment"("sourceId", "status");
CREATE INDEX "PagoEfectivoPayment_sourceId_cip_idx" ON "PagoEfectivoPayment"("sourceId", "cip");
ALTER TABLE "PagoEfectivoSyncState" ADD CONSTRAINT "PagoEfectivoSyncState_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "TreasurySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PagoEfectivoPayment" ADD CONSTRAINT "PagoEfectivoPayment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "TreasurySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
