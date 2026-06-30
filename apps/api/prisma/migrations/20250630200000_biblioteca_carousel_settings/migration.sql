-- CreateTable
CREATE TABLE "BibliotecaCarouselSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "headerTitle" TEXT NOT NULL DEFAULT 'CONOCE NUESTRAS NUEVAS ADQUISICIONES',
    "headerColor" TEXT NOT NULL DEFAULT '#e82323',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BibliotecaCarouselSettings_pkey" PRIMARY KEY ("id")
);

-- Seed default row
INSERT INTO "BibliotecaCarouselSettings" ("id", "headerTitle", "headerColor", "updatedAt")
VALUES ('default', 'CONOCE NUESTRAS NUEVAS ADQUISICIONES', '#e82323', CURRENT_TIMESTAMP);
