-- AlterTable
ALTER TABLE "EducacionPopupSettings" ADD COLUMN     "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduleDateStart" TEXT,
ADD COLUMN     "scheduleDateEnd" TEXT,
ADD COLUMN     "scheduleTimeStart" TEXT,
ADD COLUMN     "scheduleTimeEnd" TEXT,
ADD COLUMN     "scheduleTimezone" TEXT NOT NULL DEFAULT 'America/Lima';

-- CreateTable
CREATE TABLE "MuseoPopupSettings" (
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
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleDateStart" TEXT,
    "scheduleDateEnd" TEXT,
    "scheduleTimeStart" TEXT,
    "scheduleTimeEnd" TEXT,
    "scheduleTimezone" TEXT NOT NULL DEFAULT 'America/Lima',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MuseoPopupSettings_pkey" PRIMARY KEY ("id")
);
