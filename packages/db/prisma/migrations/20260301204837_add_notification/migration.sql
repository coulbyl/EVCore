-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ROI_ALERT', 'MARKET_SUSPENSION', 'BRIER_ALERT', 'WEEKLY_REPORT', 'ETL_FAILURE', 'WEIGHT_ADJUSTMENT');

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_read_createdAt_idx" ON "notification"("read", "createdAt");
