-- Remove unused independent PagoEfectivo source (covered by Niubiz PayCash)
-- and catalog-only Niubiz En línea (niubiz_settlements).

DROP TABLE IF EXISTS "PagoEfectivoPayment";
DROP TABLE IF EXISTS "PagoEfectivoSyncState";

DELETE FROM "TreasuryTarget"
WHERE "sourceId" IN (
  SELECT "id" FROM "TreasurySource"
  WHERE "provider"::text IN ('pagoefectivo', 'niubiz_settlements')
);

DELETE FROM "TreasurySource"
WHERE "provider"::text IN ('pagoefectivo', 'niubiz_settlements');

ALTER TABLE "TreasurySource" ALTER COLUMN "provider" SET DATA TYPE TEXT;
ALTER TABLE "TreasuryPayment" ALTER COLUMN "provider" SET DATA TYPE TEXT;
ALTER TABLE "TreasuryPaymentImport" ALTER COLUMN "provider" SET DATA TYPE TEXT;

DROP TYPE "TreasuryProvider";

CREATE TYPE "TreasuryProvider" AS ENUM (
  'bcp',
  'interbank',
  'niubiz_sales',
  'diners',
  'expressnet',
  'mercadopago'
);

ALTER TABLE "TreasurySource"
  ALTER COLUMN "provider" SET DATA TYPE "TreasuryProvider"
  USING "provider"::"TreasuryProvider";

ALTER TABLE "TreasuryPayment"
  ALTER COLUMN "provider" SET DATA TYPE "TreasuryProvider"
  USING "provider"::"TreasuryProvider";

ALTER TABLE "TreasuryPaymentImport"
  ALTER COLUMN "provider" SET DATA TYPE "TreasuryProvider"
  USING "provider"::"TreasuryProvider";
