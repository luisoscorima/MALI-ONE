-- AlterTable
ALTER TABLE "EducacionOpportunity" ADD COLUMN "prospectiaStatus" TEXT;
ALTER TABLE "EducacionOpportunity" ADD COLUMN "interestCourse" TEXT;
ALTER TABLE "EducacionOpportunity" ADD COLUMN "leadScore" INTEGER;

-- CreateIndex
CREATE INDEX "EducacionOpportunity_prospectiaStatus_idx" ON "EducacionOpportunity"("prospectiaStatus");
CREATE INDEX "EducacionOpportunity_interestCourse_idx" ON "EducacionOpportunity"("interestCourse");
