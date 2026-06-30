-- CreateTable
CREATE TABLE "EducacionPopupSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "imagenUrl" TEXT NOT NULL,
    "imagenLinkUrl" TEXT,
    "imagenTarget" TEXT NOT NULL DEFAULT '_blank',
    "titulo" TEXT,
    "botonTexto" TEXT NOT NULL,
    "botonUrl" TEXT NOT NULL,
    "botonTarget" TEXT NOT NULL DEFAULT '_blank',
    "showOnce" BOOLEAN NOT NULL DEFAULT false,
    "delayMs" INTEGER NOT NULL DEFAULT 800,
    "animationSpeedMs" INTEGER NOT NULL DEFAULT 300,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducacionPopupSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionAliado" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "url" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EducacionAliado_pkey" PRIMARY KEY ("id")
);
