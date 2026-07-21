-- Catálogo editable de medios de pago + rename paymentGateway → paymentMethod

CREATE TABLE IF NOT EXISTS "PamPaymentMethod" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PamPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PamPaymentMethod_slug_key" ON "PamPaymentMethod"("slug");
CREATE INDEX IF NOT EXISTS "PamPaymentMethod_active_sortOrder_idx"
  ON "PamPaymentMethod"("active", "sortOrder");

INSERT INTO "PamPaymentMethod" ("id", "slug", "label", "active", "system", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'cml_pago_mp_default',
  'mercado_pago',
  'Mercado Pago',
  true,
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PamRegistration' AND column_name = 'paymentGateway'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PamRegistration' AND column_name = 'paymentMethod'
  ) THEN
    ALTER TABLE "PamRegistration" RENAME COLUMN "paymentGateway" TO "paymentMethod";
  END IF;
END $$;

DROP INDEX IF EXISTS "PamRegistration_paymentGateway_idx";

CREATE INDEX IF NOT EXISTS "PamRegistration_paymentMethod_idx"
  ON "PamRegistration"("paymentMethod");
