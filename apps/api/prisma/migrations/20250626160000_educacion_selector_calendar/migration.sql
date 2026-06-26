-- CreateTable
CREATE TABLE "EducacionSelectorSede" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "brochureUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EducacionSelectorSede_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EducacionSelectorSede_slug_key" ON "EducacionSelectorSede"("slug");

-- AlterTable
ALTER TABLE "EducacionWidgetSettings" ADD COLUMN "googleCalendarId" TEXT;

-- Migrate selector-only sedes into EducacionSelectorSede
INSERT INTO "EducacionSelectorSede" ("id", "slug", "nombre", "brochureUrl", "sortOrder", "activo")
SELECT
    'sel-' || "slug",
    "slug",
    "nombre",
    "brochureUrl",
    "sortOrder",
    "activo"
FROM "EducacionSede"
WHERE "showOnSelector" = true AND "showOnMap" = false;

DELETE FROM "EducacionSede"
WHERE "showOnSelector" = true AND "showOnMap" = false;

ALTER TABLE "EducacionSede" DROP COLUMN "showOnSelector";

-- Default calendar id for educación
UPDATE "EducacionWidgetSettings"
SET "googleCalendarId" = 'talleresmali@mali.pe'
WHERE "id" = 'default' AND ("googleCalendarId" IS NULL OR "googleCalendarId" = '');
