-- CreateEnum
CREATE TYPE "ScreenCastOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');

-- AlterTable
ALTER TABLE "ScreenCastMonitor" ADD COLUMN "orientation" "ScreenCastOrientation" NOT NULL DEFAULT 'LANDSCAPE';
