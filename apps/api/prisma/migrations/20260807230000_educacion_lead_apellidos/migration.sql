-- Unifica apellidoPaterno + apellidoMaterno → apellidos (solo si aún existen las columnas viejas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'EducacionLead'
      AND column_name = 'apellidoPaterno'
  ) THEN
    ALTER TABLE "EducacionLead" ADD COLUMN IF NOT EXISTS "apellidos" TEXT;

    UPDATE "EducacionLead"
    SET "apellidos" = TRIM(CONCAT(COALESCE("apellidoPaterno", ''), ' ', COALESCE("apellidoMaterno", '')))
    WHERE "apellidos" IS NULL OR TRIM("apellidos") = '';

    UPDATE "EducacionLead"
    SET "apellidos" = '—'
    WHERE "apellidos" IS NULL OR TRIM("apellidos") = '';

    ALTER TABLE "EducacionLead" ALTER COLUMN "apellidos" SET NOT NULL;

    ALTER TABLE "EducacionLead" DROP COLUMN IF EXISTS "apellidoPaterno";
    ALTER TABLE "EducacionLead" DROP COLUMN IF EXISTS "apellidoMaterno";
  END IF;
END $$;
