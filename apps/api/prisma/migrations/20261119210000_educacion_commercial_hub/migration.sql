-- Hub comercial CRM Educación: Persona ampliada + autoridad comercial por oportunidad
ALTER TABLE "EducacionPerson" ADD COLUMN IF NOT EXISTS "phones" JSONB;
ALTER TABLE "EducacionPerson" ADD COLUMN IF NOT EXISTS "prospectiaContactId" TEXT;

CREATE INDEX IF NOT EXISTS "EducacionPerson_prospectiaContactId_idx"
  ON "EducacionPerson"("prospectiaContactId");

ALTER TABLE "EducacionOpportunity" ADD COLUMN IF NOT EXISTS "commercialAuthority" TEXT NOT NULL DEFAULT 'one';

-- Filas ya existentes: Prospectia = one; si solo tienen puente WA sin canal nativo, wa
UPDATE "EducacionOpportunity"
SET "commercialAuthority" = CASE
  WHEN "channel" = 'prospectia' THEN 'one'
  WHEN "channel" IN ('manual', 'widget', 'anura') THEN 'one'
  WHEN "waCycleId" IS NOT NULL AND "channel" = 'wa_mirror' THEN 'wa'
  ELSE 'one'
END
WHERE "commercialAuthority" IS NULL OR "commercialAuthority" = 'one';

CREATE INDEX IF NOT EXISTS "EducacionOpportunity_commercialAuthority_closedAt_idx"
  ON "EducacionOpportunity"("commercialAuthority", "closedAt");

CREATE INDEX IF NOT EXISTS "EducacionOpportunity_stageSlug_idx"
  ON "EducacionOpportunity"("stageSlug");
