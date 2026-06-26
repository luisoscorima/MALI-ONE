-- CreateEnum
CREATE TYPE "PamEmailStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR_DATOS', 'ERROR_TEMP');

-- CreateEnum
CREATE TYPE "PamMpStatus" AS ENUM ('pending', 'in_process', 'approved', 'authorized', 'rejected', 'cancelled', 'refunded', 'charged_back');

-- AlterEnum
ALTER TYPE "AppModule" ADD VALUE 'widget_educacion';
ALTER TYPE "AppModule" ADD VALUE 'widget_biblioteca';
ALTER TYPE "AppModule" ADD VALUE 'widget_pam';

-- CreateTable
CREATE TABLE "EducacionWidgetSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "whatsapp" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVirtual" TEXT NOT NULL,
    "soporteVirtual" TEXT NOT NULL,
    "imageRectangulo" TEXT NOT NULL,
    "imageWhatsapp" TEXT NOT NULL,
    "imageCorreo" TEXT NOT NULL,
    "mapsApiKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EducacionWidgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionDistrict" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EducacionDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EducacionSede" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "horarioHtml" TEXT,
    "brochureUrl" TEXT NOT NULL,
    "districtId" TEXT,
    "showOnMap" BOOLEAN NOT NULL DEFAULT true,
    "showOnSelector" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EducacionSede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BibliotecaCarouselItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "descriptionHtml" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "imageSrc" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "backgroundSrc" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BibliotecaCarouselItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PamWidgetSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "benefits" JSONB NOT NULL,
    "notes" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PamWidgetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PamPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "monthlyPrice" TEXT NOT NULL,
    "monthlyDuration" TEXT NOT NULL,
    "monthlyCheckout" TEXT NOT NULL,
    "monthlyValues" JSONB NOT NULL,
    "yearlyPrice" TEXT NOT NULL,
    "yearlyDuration" TEXT NOT NULL,
    "yearlyCheckout" TEXT NOT NULL,
    "yearlyValues" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PamPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PamRegistration" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "distrito" TEXT,
    "genero" TEXT,
    "fechaNacimiento" TEXT,
    "comoTeEnteraste" TEXT,
    "plan" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "aceptaPrivacidad" BOOLEAN NOT NULL,
    "mpStatus" "PamMpStatus",
    "welcomeEmail" "PamEmailStatus" NOT NULL DEFAULT 'PENDIENTE',
    "expiryNotice" "PamEmailStatus" NOT NULL DEFAULT 'PENDIENTE',
    "expiryDate" TIMESTAMP(3),

    CONSTRAINT "PamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EducacionDistrict_slug_key" ON "EducacionDistrict"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EducacionSede_slug_key" ON "EducacionSede"("slug");

-- CreateIndex
CREATE INDEX "EducacionSede_districtId_idx" ON "EducacionSede"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "PamPlan_slug_key" ON "PamPlan"("slug");

-- CreateIndex
CREATE INDEX "PamRegistration_correo_idx" ON "PamRegistration"("correo");

-- CreateIndex
CREATE INDEX "PamRegistration_mpStatus_idx" ON "PamRegistration"("mpStatus");

-- AddForeignKey
ALTER TABLE "EducacionSede" ADD CONSTRAINT "EducacionSede_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "EducacionDistrict"("id") ON DELETE SET NULL ON UPDATE CASCADE;
