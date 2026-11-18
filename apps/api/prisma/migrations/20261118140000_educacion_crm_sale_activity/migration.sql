-- CreateTable
CREATE TABLE "EducacionCrmActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "waCycleId" INTEGER NOT NULL,
    "waContactId" INTEGER,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorEmail" TEXT,
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "externalRef" TEXT,
    "externalSystem" TEXT,

    CONSTRAINT "EducacionCrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionSale" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "waCycleId" INTEGER NOT NULL,
    "waContactId" INTEGER,
    "advisorEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "amountAgreed" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "paymentStatus" TEXT NOT NULL DEFAULT 'sin_verificar',
    "billingStatus" TEXT NOT NULL DEFAULT 'pending',
    "billingNote" TEXT,
    "enrollmentRef" TEXT,
    "enrollmentAt" TIMESTAMP(3),
    "buyerName" TEXT,
    "studentName" TEXT,
    "payerName" TEXT,
    "reportedTxnCode" TEXT,
    "notes" TEXT,

    CONSTRAINT "EducacionSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "catalogRef" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EducacionSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionPaymentApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "saleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT NOT NULL,
    "transactionCode" TEXT NOT NULL,
    "amountApplied" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "validatedByEmail" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedByEmail" TEXT,
    "reverseReason" TEXT,

    CONSTRAINT "EducacionPaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EducacionCrmActivity_waCycleId_occurredAt_idx" ON "EducacionCrmActivity"("waCycleId", "occurredAt");
CREATE INDEX "EducacionCrmActivity_externalSystem_externalRef_idx" ON "EducacionCrmActivity"("externalSystem", "externalRef");
CREATE UNIQUE INDEX "EducacionSale_waCycleId_key" ON "EducacionSale"("waCycleId");
CREATE INDEX "EducacionSale_paymentStatus_idx" ON "EducacionSale"("paymentStatus");
CREATE INDEX "EducacionSale_billingStatus_idx" ON "EducacionSale"("billingStatus");
CREATE INDEX "EducacionSale_reportedTxnCode_idx" ON "EducacionSale"("reportedTxnCode");
CREATE INDEX "EducacionSaleItem_saleId_idx" ON "EducacionSaleItem"("saleId");
CREATE INDEX "EducacionPaymentApplication_saleId_idx" ON "EducacionPaymentApplication"("saleId");
CREATE INDEX "EducacionPaymentApplication_provider_providerPaymentId_idx" ON "EducacionPaymentApplication"("provider", "providerPaymentId");
CREATE INDEX "EducacionPaymentApplication_transactionCode_idx" ON "EducacionPaymentApplication"("transactionCode");

-- AddForeignKey
ALTER TABLE "EducacionSaleItem" ADD CONSTRAINT "EducacionSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "EducacionSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EducacionPaymentApplication" ADD CONSTRAINT "EducacionPaymentApplication_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "EducacionSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
