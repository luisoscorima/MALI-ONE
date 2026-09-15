CREATE TYPE "PortfolioProjectType" AS ENUM ('estrategico', 'tactico', 'operativo', 'mejora', 'migracion', 'otro');

ALTER TABLE "PortfolioProject" ADD COLUMN "projectType" "PortfolioProjectType" NOT NULL DEFAULT 'otro';
ALTER TABLE "PortfolioProject" ADD COLUMN "stakeholder" TEXT;

CREATE INDEX "PortfolioProject_projectType_idx" ON "PortfolioProject"("projectType");
