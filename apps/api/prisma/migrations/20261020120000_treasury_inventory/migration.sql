ALTER TYPE "AppModule" ADD VALUE 'treasury';

CREATE TYPE "TreasuryProvider" AS ENUM ('bcp', 'niubiz_sales', 'niubiz_settlements', 'diners', 'expressnet', 'pagoefectivo', 'mercadopago');
CREATE TYPE "TreasuryTargetKind" AS ENUM ('bank_account', 'merchant');
CREATE TYPE "TreasuryCurrency" AS ENUM ('PEN', 'USD');

CREATE TABLE "TreasurySource" (
    "id" TEXT NOT NULL,
    "provider" "TreasuryProvider" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "legalEntity" VARCHAR(160) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TreasurySource_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TreasurySource_hourly_check" CHECK ("syncIntervalMinutes" = 60)
);

CREATE TABLE "TreasuryTarget" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" "TreasuryTargetKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "reference" VARCHAR(64) NOT NULL,
    "currency" "TreasuryCurrency" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TreasuryTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TreasurySource_provider_name_key" ON "TreasurySource"("provider", "name");
CREATE UNIQUE INDEX "TreasuryTarget_sourceId_reference_currency_key" ON "TreasuryTarget"("sourceId", "reference", "currency");
ALTER TABLE "TreasuryTarget" ADD CONSTRAINT "TreasuryTarget_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "TreasurySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
