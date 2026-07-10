-- CreateEnum
CREATE TYPE "ScreenCastMediaType" AS ENUM ('image', 'video', 'gif');

-- AlterEnum
ALTER TYPE "AppModule" ADD VALUE 'screen_cast';

-- CreateTable
CREATE TABLE "ScreenCastPlaylist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenCastPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenCastPlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "ScreenCastMediaType" NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 10000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScreenCastPlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenCastMonitor" (
    "id" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "playlistId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenCastMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenCastPlaylistItem_playlistId_sortOrder_idx" ON "ScreenCastPlaylistItem"("playlistId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenCastMonitor_screenKey_key" ON "ScreenCastMonitor"("screenKey");

-- CreateIndex
CREATE INDEX "ScreenCastMonitor_playlistId_idx" ON "ScreenCastMonitor"("playlistId");

-- AddForeignKey
ALTER TABLE "ScreenCastPlaylistItem" ADD CONSTRAINT "ScreenCastPlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "ScreenCastPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenCastMonitor" ADD CONSTRAINT "ScreenCastMonitor_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "ScreenCastPlaylist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
