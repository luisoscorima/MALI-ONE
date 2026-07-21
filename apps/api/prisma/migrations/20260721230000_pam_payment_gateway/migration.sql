-- Pasarela / opción de pago en ledger PAM
ALTER TABLE "PamRegistration"
  ADD COLUMN IF NOT EXISTS "paymentGateway" TEXT NOT NULL DEFAULT 'mercado_pago';

CREATE INDEX IF NOT EXISTS "PamRegistration_paymentGateway_idx"
  ON "PamRegistration"("paymentGateway");
