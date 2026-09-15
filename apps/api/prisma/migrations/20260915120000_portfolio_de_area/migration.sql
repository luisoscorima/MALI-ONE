-- Rename AppModule.todos -> portfolio
ALTER TYPE "AppModule" RENAME VALUE 'todos' TO 'portfolio';

-- New enums
CREATE TYPE "PortfolioArea" AS ENUM ('infraestructura', 'aplicaciones', 'datos', 'seguridad', 'contenidos', 'otros');
CREATE TYPE "PortfolioImpact" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "TodoOrigin" AS ENUM ('internal', 'request', 'incident');
CREATE TYPE "OperationalServiceStatus" AS ENUM ('up', 'degraded', 'down', 'maintenance');

-- Project status catalog
CREATE TABLE "PortfolioProjectStatus" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioProjectStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioProjectStatus_key_key" ON "PortfolioProjectStatus"("key");

-- Projects
CREATE TABLE "PortfolioProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "statusId" TEXT NOT NULL,
    "area" "PortfolioArea" NOT NULL DEFAULT 'otros',
    "impact" "PortfolioImpact" NOT NULL DEFAULT 'medium',
    "link" TEXT,
    "targetAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioProject_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortfolioProject_ownerId_idx" ON "PortfolioProject"("ownerId");
CREATE INDEX "PortfolioProject_statusId_idx" ON "PortfolioProject"("statusId");
CREATE INDEX "PortfolioProject_area_idx" ON "PortfolioProject"("area");
CREATE INDEX "PortfolioProject_ownerId_statusId_idx" ON "PortfolioProject"("ownerId", "statusId");
CREATE INDEX "PortfolioProject_ownerId_archivedAt_idx" ON "PortfolioProject"("ownerId", "archivedAt");
CREATE INDEX "PortfolioProject_targetAt_idx" ON "PortfolioProject"("targetAt");

ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PortfolioProjectStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend TodoItem
ALTER TABLE "TodoItem" ADD COLUMN "projectId" TEXT;
ALTER TABLE "TodoItem" ADD COLUMN "area" "PortfolioArea";
ALTER TABLE "TodoItem" ADD COLUMN "origin" "TodoOrigin" NOT NULL DEFAULT 'internal';
ALTER TABLE "TodoItem" ADD COLUMN "impact" "PortfolioImpact" NOT NULL DEFAULT 'medium';
ALTER TABLE "TodoItem" ADD COLUMN "link" TEXT;
ALTER TABLE "TodoItem" ADD COLUMN "scheduledAt" TIMESTAMP(3);

CREATE INDEX "TodoItem_scheduledAt_idx" ON "TodoItem"("scheduledAt");
CREATE INDEX "TodoItem_projectId_idx" ON "TodoItem"("projectId");
CREATE INDEX "TodoItem_area_idx" ON "TodoItem"("area");
CREATE INDEX "TodoItem_origin_idx" ON "TodoItem"("origin");

ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PortfolioProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Operational services
CREATE TABLE "OperationalService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OperationalServiceStatus" NOT NULL DEFAULT 'up',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalService_ownerId_idx" ON "OperationalService"("ownerId");
CREATE INDEX "OperationalService_status_idx" ON "OperationalService"("status");
CREATE INDEX "OperationalService_ownerId_sortOrder_idx" ON "OperationalService"("ownerId", "sortOrder");

ALTER TABLE "OperationalService" ADD CONSTRAINT "OperationalService_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
