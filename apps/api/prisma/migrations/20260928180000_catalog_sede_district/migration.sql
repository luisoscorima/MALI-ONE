ALTER TABLE "EducacionCatalogSede" ADD COLUMN "districtId" TEXT;

CREATE INDEX "EducacionCatalogSede_districtId_idx" ON "EducacionCatalogSede"("districtId");

ALTER TABLE "EducacionCatalogSede"
  ADD CONSTRAINT "EducacionCatalogSede_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "EducacionDistrict"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "EducacionCatalogSede" AS catalog
SET "districtId" = map."districtId"
FROM "EducacionSede" AS map
WHERE catalog."brochureUrl" IS NOT NULL
  AND catalog."brochureUrl" = map."brochureUrl"
  AND map."districtId" IS NOT NULL;
