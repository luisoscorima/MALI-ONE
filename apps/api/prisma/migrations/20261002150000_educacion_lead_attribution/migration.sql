ALTER TABLE "EducacionLead"
ADD COLUMN "captureSource" TEXT NOT NULL DEFAULT 'wordpress_widget',
ADD COLUMN "referrer" TEXT,
ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmMedium" TEXT,
ADD COLUMN "utmCampaign" TEXT,
ADD COLUMN "utmContent" TEXT,
ADD COLUMN "utmTerm" TEXT,
ADD COLUMN "gclid" TEXT,
ADD COLUMN "fbclid" TEXT;

CREATE INDEX "EducacionLead_captureSource_idx" ON "EducacionLead"("captureSource");
CREATE INDEX "EducacionLead_utmCampaign_idx" ON "EducacionLead"("utmCampaign");
