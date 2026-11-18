-- Treasury target catalog + payment link + access grants foundation.

-- 1) Target columns and uniqueness
ALTER TABLE "TreasuryTarget" ADD COLUMN IF NOT EXISTS "externalName" VARCHAR(200);
ALTER TABLE "TreasuryTarget" ADD COLUMN IF NOT EXISTS "paycashEnabled" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "TreasuryTarget_sourceId_reference_currency_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryTarget_sourceId_reference_key" ON "TreasuryTarget"("sourceId", "reference");
CREATE INDEX IF NOT EXISTS "TreasuryTarget_sourceId_active_idx" ON "TreasuryTarget"("sourceId", "active");

ALTER TABLE "TreasuryTarget" ALTER COLUMN "currency" DROP NOT NULL;
UPDATE "TreasuryTarget" SET "currency" = NULL WHERE "kind" = 'merchant';

-- 2) Access grants (ACL foundation; not enforced yet)
CREATE TABLE IF NOT EXISTS "TreasuryAccessGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "targetId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TreasuryAccessGrant_userId_idx" ON "TreasuryAccessGrant"("userId");
CREATE INDEX IF NOT EXISTS "TreasuryAccessGrant_sourceId_idx" ON "TreasuryAccessGrant"("sourceId");
-- Postgres treats NULLs as distinct in UNIQUE; use partial indexes for whole-source vs target grants.
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryAccessGrant_user_source_whole_key"
  ON "TreasuryAccessGrant"("userId", "sourceId") WHERE "targetId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryAccessGrant_user_source_target_key"
  ON "TreasuryAccessGrant"("userId", "sourceId", "targetId") WHERE "targetId" IS NOT NULL;

ALTER TABLE "TreasuryAccessGrant"
  DROP CONSTRAINT IF EXISTS "TreasuryAccessGrant_userId_fkey",
  ADD CONSTRAINT "TreasuryAccessGrant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryAccessGrant"
  DROP CONSTRAINT IF EXISTS "TreasuryAccessGrant_sourceId_fkey",
  ADD CONSTRAINT "TreasuryAccessGrant_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "TreasurySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryAccessGrant"
  DROP CONSTRAINT IF EXISTS "TreasuryAccessGrant_targetId_fkey",
  ADD CONSTRAINT "TreasuryAccessGrant_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "TreasuryTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Seed Niubiz source + five merchants (idempotent)
INSERT INTO "TreasurySource" ("id", "provider", "name", "legalEntity", "active", "syncIntervalMinutes", "createdAt", "updatedAt")
SELECT 'cseed_niubiz_source01', 'niubiz_sales', 'Niubiz Comercio', 'Niubiz', true, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "TreasurySource" WHERE "provider" = 'niubiz_sales');

WITH src AS (
  SELECT "id" FROM "TreasurySource" WHERE "provider" = 'niubiz_sales' ORDER BY "updatedAt" DESC LIMIT 1
),
seed(reference, name, "externalName", "paycashEnabled") AS (
  VALUES
    ('650177853', 'Cursos', 'CURSOSDELMALI', true),
    ('650178711', 'MALI 650178711', 'MUSEO DE ARTE DE LIMA', false),
    ('650239803', 'Asociación 650239803', 'ASOCIACION MUSEO DE ARTE DE LIMA', false),
    ('650239881', 'Ventas web', 'MUSEO DE ARTE DE LIMA', false),
    ('651047392', 'Asociación 651047392', 'ASOCIACION MUSEO DE ARTE DE LIMA', false)
)
INSERT INTO "TreasuryTarget" (
  "id", "sourceId", "kind", "name", "reference", "externalName", "currency", "active", "paycashEnabled", "createdAt", "updatedAt"
)
SELECT
  'cseed_niubiz_' || s.reference,
  src."id",
  'merchant',
  s.name,
  s.reference,
  s."externalName",
  NULL,
  true,
  s."paycashEnabled",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM seed s CROSS JOIN src
ON CONFLICT ("sourceId", "reference") DO UPDATE SET
  "name" = EXCLUDED."name",
  "externalName" = EXCLUDED."externalName",
  "paycashEnabled" = EXCLUDED."paycashEnabled",
  "currency" = NULL,
  "kind" = 'merchant',
  "updatedAt" = CURRENT_TIMESTAMP;

-- Ensure only one paycash flag among Niubiz merchants after seed/update
UPDATE "TreasuryTarget" t
SET "paycashEnabled" = (t."reference" = '650177853'),
    "updatedAt" = CURRENT_TIMESTAMP
FROM "TreasurySource" s
WHERE t."sourceId" = s."id" AND s."provider" = 'niubiz_sales';

-- 4) Link payments to targets
ALTER TABLE "TreasuryPayment" ADD COLUMN IF NOT EXISTS "targetId" TEXT;

UPDATE "TreasuryPayment" p
SET "targetId" = t."id"
FROM "TreasuryTarget" t
JOIN "TreasurySource" s ON s."id" = t."sourceId"
WHERE p."targetId" IS NULL
  AND p."provider" = 'niubiz_sales'
  AND s."provider" = 'niubiz_sales'
  AND t."reference" = p."merchantCode";

-- Orphan test rows without a catalog merchant are dropped (no production data yet).
DELETE FROM "TreasuryPayment" WHERE "provider" = 'niubiz_sales' AND "targetId" IS NULL;

ALTER TABLE "TreasuryPayment" ALTER COLUMN "targetId" SET NOT NULL;

DROP INDEX IF EXISTS "TreasuryPayment_provider_merchantCode_transactionCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryPayment_targetId_transactionCode_key"
  ON "TreasuryPayment"("targetId", "transactionCode");
CREATE INDEX IF NOT EXISTS "TreasuryPayment_provider_merchantCode_idx"
  ON "TreasuryPayment"("provider", "merchantCode");

ALTER TABLE "TreasuryPayment"
  DROP CONSTRAINT IF EXISTS "TreasuryPayment_targetId_fkey",
  ADD CONSTRAINT "TreasuryPayment_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "TreasuryTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prefer a stable PayCash sync-state id; copy legacy row keyed by merchant code if present.
INSERT INTO "NiubizPayCashSyncState" (
  "id", "runId", "status", "startedAt", "finishedAt", "leaseUntil", "errorCode",
  "rowCount", "createdCount", "updatedCount", "lastSuccessfulAt", "lastSuccessfulRowCount"
)
SELECT
  'niubiz_paycash', "runId", "status", "startedAt", "finishedAt", "leaseUntil", "errorCode",
  "rowCount", "createdCount", "updatedCount", "lastSuccessfulAt", "lastSuccessfulRowCount"
FROM "NiubizPayCashSyncState"
WHERE "id" = '650177853'
  AND NOT EXISTS (SELECT 1 FROM "NiubizPayCashSyncState" WHERE "id" = 'niubiz_paycash');
