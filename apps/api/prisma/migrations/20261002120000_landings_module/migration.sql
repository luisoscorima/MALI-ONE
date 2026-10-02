ALTER TYPE "AppModule" ADD VALUE 'landings';

CREATE TYPE "LandingStatus" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "LandingStatus" NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "publishedHtml" TEXT,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");
CREATE INDEX "LandingPage_status_updatedAt_idx" ON "LandingPage"("status", "updatedAt");
CREATE INDEX "LandingPage_createdById_idx" ON "LandingPage"("createdById");
CREATE INDEX "LandingPage_updatedById_idx" ON "LandingPage"("updatedById");

ALTER TABLE "LandingPage"
ADD CONSTRAINT "LandingPage_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LandingPage"
ADD CONSTRAINT "LandingPage_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
