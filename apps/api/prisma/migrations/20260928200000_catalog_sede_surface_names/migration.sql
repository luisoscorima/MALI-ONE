ALTER TABLE "EducacionCatalogSede" ADD COLUMN "nombreMapa" TEXT;
ALTER TABLE "EducacionCatalogSede" ADD COLUMN "nombreSelector" TEXT;

UPDATE "EducacionCatalogSede" AS catalog
SET "showOnSelector" = sel."activo"
FROM "EducacionSelectorSede" AS sel
WHERE catalog."id" = sel."id";

UPDATE "EducacionCatalogSede" AS catalog
SET
    "showOnMap" = map."activo" AND map."showOnMap",
    "nombreMapa" = CASE
        WHEN map."nombre" <> catalog."nombre" THEN map."nombre"
        ELSE catalog."nombreMapa"
    END,
    "direccion" = COALESCE(catalog."direccion", map."direccion"),
    "lat" = COALESCE(catalog."lat", map."lat"),
    "lng" = COALESCE(catalog."lng", map."lng"),
    "horarioHtml" = COALESCE(catalog."horarioHtml", map."horarioHtml"),
    "districtId" = COALESCE(catalog."districtId", map."districtId")
FROM "EducacionSede" AS map
WHERE catalog."brochureUrl" IS NOT NULL
  AND catalog."brochureUrl" = map."brochureUrl";

INSERT INTO "EducacionCatalogSede" (
    "id", "slug", "nombre", "direccion", "brochureUrl", "icon",
    "lat", "lng", "horarioHtml", "districtId",
    "showOnSelector", "showOnMap", "activo", "sortOrder",
    "createdAt", "updatedAt"
)
SELECT
    map."id",
    CASE
        WHEN EXISTS (
            SELECT 1 FROM "EducacionCatalogSede" AS taken WHERE taken."slug" = map."slug"
        )
        THEN map."slug" || '-mapa'
        ELSE map."slug"
    END,
    map."nombre",
    map."direccion",
    NULLIF(map."brochureUrl", ''),
    'location_on',
    map."lat",
    map."lng",
    map."horarioHtml",
    map."districtId",
    false,
    map."activo" AND map."showOnMap",
    map."activo",
    map."sortOrder",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "EducacionSede" AS map
WHERE NOT EXISTS (
    SELECT 1 FROM "EducacionCatalogSede" AS catalog WHERE catalog."id" = map."id"
)
AND NOT EXISTS (
    SELECT 1
    FROM "EducacionCatalogSede" AS catalog
    WHERE catalog."brochureUrl" IS NOT NULL
      AND catalog."brochureUrl" = map."brochureUrl"
);
