-- AlterTable
ALTER TABLE "User" ADD COLUMN "qrDefaultStyle" JSONB;

-- AlterTable
ALTER TABLE "ShortLink" ADD COLUMN "qrStyle" JSONB;
ALTER TABLE "ShortLink" ADD COLUMN "qrLogoKey" TEXT;

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "deviceType" TEXT NOT NULL,
    "os" TEXT,
    "browser" TEXT,

    CONSTRAINT "LinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkClick_linkId_clickedAt_idx" ON "LinkClick"("linkId", "clickedAt");

-- CreateIndex
CREATE INDEX "LinkClick_linkId_deviceType_idx" ON "LinkClick"("linkId", "deviceType");

-- AddForeignKey
ALTER TABLE "LinkClick" ADD CONSTRAINT "LinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
