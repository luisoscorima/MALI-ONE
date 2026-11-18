-- Outbox de hechos de canal WA → CRM ONE (F4 scaffolding). Productor WA pendiente.
CREATE TABLE "EducacionChannelEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "EducacionChannelEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EducacionChannelEvent_eventId_key" ON "EducacionChannelEvent"("eventId");
CREATE INDEX "EducacionChannelEvent_processedAt_idx" ON "EducacionChannelEvent"("processedAt");
CREATE INDEX "EducacionChannelEvent_eventType_occurredAt_idx" ON "EducacionChannelEvent"("eventType", "occurredAt");
