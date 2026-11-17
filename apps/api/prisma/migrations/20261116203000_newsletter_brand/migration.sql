-- Optional brand chrome for newsletters (header + footer pair).
CREATE TYPE "NewsletterBrand" AS ENUM (
  'museo',
  'cursos_arte',
  'extension_profesional'
);

ALTER TABLE "Newsletter"
  ADD COLUMN "brand" "NewsletterBrand";

CREATE INDEX "Newsletter_brand_idx" ON "Newsletter"("brand");
