CREATE TABLE "NiubizSyncState" (
 "id" TEXT PRIMARY KEY, "runId" TEXT, "status" TEXT NOT NULL DEFAULT 'idle',
 "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3), "leaseUntil" TIMESTAMP(3),
 "fromDate" TEXT, "toDate" TEXT, "errorCode" TEXT, "results" JSONB NOT NULL DEFAULT '[]'
);
