-- CreateTable
CREATE TABLE "EducacionLead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "optInMarketing" BOOLEAN NOT NULL DEFAULT false,
    "acceptPrivacy" BOOLEAN NOT NULL,
    "courseSlug" TEXT,
    "courseTitle" TEXT,
    "pageUrl" TEXT,
    "whatsappArea" TEXT NOT NULL DEFAULT 'educacion_ep',
    "fuente" TEXT NOT NULL DEFAULT 'WEB',
    "waStatus" TEXT NOT NULL DEFAULT 'pending',
    "waError" TEXT,
    "sheetStatus" TEXT NOT NULL DEFAULT 'pending',
    "sheetError" TEXT,

    CONSTRAINT "EducacionLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EducacionLead_celular_idx" ON "EducacionLead"("celular");

-- CreateIndex
CREATE INDEX "EducacionLead_email_idx" ON "EducacionLead"("email");

-- CreateIndex
CREATE INDEX "EducacionLead_createdAt_idx" ON "EducacionLead"("createdAt");

-- CreateIndex
CREATE INDEX "EducacionLead_whatsappArea_idx" ON "EducacionLead"("whatsappArea");
