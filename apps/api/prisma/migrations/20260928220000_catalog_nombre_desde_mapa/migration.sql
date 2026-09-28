-- El nombre del catálogo queda con el del mapa.
-- El selector conserva su etiqueta solo cuando es distinta.
UPDATE "EducacionCatalogSede" AS catalog
SET
    "nombre" = map."nombre",
    "nombreMapa" = NULL,
    "nombreSelector" = CASE
        WHEN sel."nombre" <> map."nombre" THEN sel."nombre"
        ELSE NULL
    END
FROM "EducacionSede" AS map
INNER JOIN "EducacionSelectorSede" AS sel ON sel."id" = catalog."id"
WHERE catalog."brochureUrl" IS NOT NULL
  AND catalog."brochureUrl" = map."brochureUrl";
