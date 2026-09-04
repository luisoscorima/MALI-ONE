-- CreateTable
CREATE TABLE "ScreenCastScheduleOverride" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenCastScheduleOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenCastScheduleOverride_monitorId_startsAt_endsAt_idx" ON "ScreenCastScheduleOverride"("monitorId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ScreenCastScheduleOverride_startsAt_endsAt_idx" ON "ScreenCastScheduleOverride"("startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "ScreenCastScheduleOverride" ADD CONSTRAINT "ScreenCastScheduleOverride_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "ScreenCastMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenCastScheduleOverride" ADD CONSTRAINT "ScreenCastScheduleOverride_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "ScreenCastPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
