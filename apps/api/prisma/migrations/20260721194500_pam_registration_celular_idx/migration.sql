-- Index for payment ledger lookups by phone (CRM match)
CREATE INDEX IF NOT EXISTS "PamRegistration_celular_idx" ON "PamRegistration"("celular");
