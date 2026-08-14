-- AlterEnum
ALTER TYPE "AppModule" ADD VALUE 'todos';
ALTER TYPE "AppModule" ADD VALUE 'files';

-- CreateEnum
CREATE TYPE "TodoPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TodoEffort" AS ENUM ('xs', 's', 'm', 'l', 'xl');

-- CreateTable
CREATE TABLE "TodoType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoStatus" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "notes" TEXT,
    "typeId" TEXT,
    "priority" "TodoPriority" NOT NULL DEFAULT 'medium',
    "effort" "TodoEffort",
    "statusId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TodoStatus_key_key" ON "TodoStatus"("key");

-- CreateIndex
CREATE INDEX "TodoItem_ownerId_idx" ON "TodoItem"("ownerId");

-- CreateIndex
CREATE INDEX "TodoItem_statusId_idx" ON "TodoItem"("statusId");

-- CreateIndex
CREATE INDEX "TodoItem_dueAt_idx" ON "TodoItem"("dueAt");

-- CreateIndex
CREATE INDEX "TodoItem_typeId_idx" ON "TodoItem"("typeId");

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TodoType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "TodoStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
