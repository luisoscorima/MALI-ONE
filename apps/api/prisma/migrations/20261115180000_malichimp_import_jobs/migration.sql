CREATE TABLE "MalichimpImportJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "originalName" VARCHAR(240) NOT NULL,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL,
  "runId" TEXT,
  "error" VARCHAR(1000),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "MalichimpImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MalichimpImportJob_status_idx" ON "MalichimpImportJob"("status");
CREATE INDEX "MalichimpImportJob_userId_startedAt_idx" ON "MalichimpImportJob"("userId", "startedAt");
CREATE UNIQUE INDEX "MalichimpImportJob_one_active_idx" ON "MalichimpImportJob" ((1))
  WHERE "status" IN ('queued', 'running');
