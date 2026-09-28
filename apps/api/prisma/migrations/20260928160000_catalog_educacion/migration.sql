ALTER TYPE "AppModule" ADD VALUE 'catalog_educacion';

CREATE TABLE "EducacionCatalogCurso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2),
    "descuento" TEXT,
    "horario" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EducacionCatalogCurso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EducacionCatalogPrograma" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2),
    "descuento" TEXT,
    "horario" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EducacionCatalogPrograma_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EducacionCatalogSede" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "brochureUrl" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'location_on',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "horarioHtml" TEXT,
    "showOnSelector" BOOLEAN NOT NULL DEFAULT true,
    "showOnMap" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EducacionCatalogSede_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EducacionCatalogSede_slug_key" ON "EducacionCatalogSede"("slug");

ALTER TABLE "ShortLink" ADD COLUMN "catalogCursoId" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "catalogProgramaId" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "catalogSedeId" TEXT;

CREATE INDEX "ShortLink_catalogCursoId_idx" ON "ShortLink"("catalogCursoId");
CREATE INDEX "ShortLink_catalogProgramaId_idx" ON "ShortLink"("catalogProgramaId");
CREATE INDEX "ShortLink_catalogSedeId_idx" ON "ShortLink"("catalogSedeId");

ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_catalogCursoId_fkey" FOREIGN KEY ("catalogCursoId") REFERENCES "EducacionCatalogCurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_catalogProgramaId_fkey" FOREIGN KEY ("catalogProgramaId") REFERENCES "EducacionCatalogPrograma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_catalogSedeId_fkey" FOREIGN KEY ("catalogSedeId") REFERENCES "EducacionCatalogSede"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "EducacionCatalogSede" (
    "id", "slug", "nombre", "brochureUrl", "icon", "sortOrder", "activo",
    "showOnSelector", "showOnMap", "createdAt", "updatedAt"
)
SELECT
    "id", "slug", "nombre", "brochureUrl", "icon", "sortOrder", "activo",
    true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "EducacionSelectorSede";

UPDATE "EducacionCatalogSede" AS catalog
SET
    "direccion" = map."direccion",
    "lat" = map."lat",
    "lng" = map."lng",
    "horarioHtml" = map."horarioHtml",
    "showOnMap" = map."showOnMap"
FROM "EducacionSede" AS map
WHERE catalog."brochureUrl" IS NOT NULL
  AND catalog."brochureUrl" = map."brochureUrl";
