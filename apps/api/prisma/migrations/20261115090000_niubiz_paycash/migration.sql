CREATE TABLE "NiubizPayCashPayment" (
    "id" TEXT NOT NULL,
    "merchantCode" VARCHAR(9) NOT NULL,
    "cip" VARCHAR(80) NOT NULL,
    "customerEmail" VARCHAR(250),
    "currency" "TreasuryCurrency" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "brand" VARCHAR(80) NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NiubizPayCashPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NiubizPayCashPayment_merchantCode_cip_key" ON "NiubizPayCashPayment"("merchantCode", "cip");
CREATE INDEX "NiubizPayCashPayment_merchantCode_purchasedAt_id_idx" ON "NiubizPayCashPayment"("merchantCode", "purchasedAt", "id");
CREATE INDEX "NiubizPayCashPayment_merchantCode_status_idx" ON "NiubizPayCashPayment"("merchantCode", "status");

CREATE TABLE "NiubizPayCashSyncState" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "errorCode" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "NiubizPayCashSyncState_pkey" PRIMARY KEY ("id")
);
