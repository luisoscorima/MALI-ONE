CREATE TABLE "EducacionCatalogArea" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentId" TEXT,
    "whatsappArea" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EducacionCatalogArea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EducacionCatalogArea_slug_key" ON "EducacionCatalogArea"("slug");
CREATE INDEX "EducacionCatalogArea_parentId_idx" ON "EducacionCatalogArea"("parentId");

ALTER TABLE "EducacionCatalogArea"
  ADD CONSTRAINT "EducacionCatalogArea_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "EducacionCatalogArea"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EducacionCatalogCurso" ADD COLUMN "areaId" TEXT;

CREATE INDEX "EducacionCatalogCurso_areaId_idx" ON "EducacionCatalogCurso"("areaId");

ALTER TABLE "EducacionCatalogCurso"
  ADD CONSTRAINT "EducacionCatalogCurso_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "EducacionCatalogArea"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
