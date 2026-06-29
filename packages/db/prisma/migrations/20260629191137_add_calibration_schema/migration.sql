/*
  Warnings:

  - You are about to drop the `adjustment_proposal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `market_suspension` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "calibration";

-- DropTable
DROP TABLE "adjustment_proposal";

-- DropTable
DROP TABLE "market_suspension";

-- CreateTable
CREATE TABLE "calibration"."adjustment_proposal" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "triggerBetCount" INTEGER NOT NULL,
    "currentWeights" JSONB NOT NULL,
    "proposedWeights" JSONB NOT NULL,
    "calibrationError" DECIMAL(6,5) NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adjustment_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration"."market_suspension" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "market" "Market" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'auto',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration"."calibration_report" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "channel" "StrategyChannel" NOT NULL,
    "competitionCode" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "betCount" INTEGER NOT NULL,
    "brierScore" DECIMAL(8,6) NOT NULL,
    "calibrationError" DECIMAL(8,6) NOT NULL,
    "roi" DECIMAL(8,5) NOT NULL,
    "evBins" JSONB NOT NULL DEFAULT '[]',
    "triggeredBy" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibration_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration"."channel_tuning_result" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "channel" "StrategyChannel" NOT NULL,
    "competitionCode" TEXT,
    "configSnapshot" JSONB NOT NULL,
    "betCount" INTEGER NOT NULL,
    "roi" DECIMAL(8,5) NOT NULL,
    "hitRate" DECIMAL(5,4) NOT NULL,
    "maxDrawdown" DECIMAL(8,5) NOT NULL,
    "improved" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_tuning_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adjustment_proposal_status_appliedAt_idx" ON "calibration"."adjustment_proposal"("status", "appliedAt");

-- CreateIndex
CREATE INDEX "adjustment_proposal_createdAt_idx" ON "calibration"."adjustment_proposal"("createdAt");

-- CreateIndex
CREATE INDEX "market_suspension_market_active_idx" ON "calibration"."market_suspension"("market", "active");

-- CreateIndex
CREATE INDEX "calibration_report_channel_endDate_idx" ON "calibration"."calibration_report"("channel", "endDate");

-- CreateIndex
CREATE INDEX "calibration_report_createdAt_idx" ON "calibration"."calibration_report"("createdAt");

-- CreateIndex
CREATE INDEX "channel_tuning_result_channel_createdAt_idx" ON "calibration"."channel_tuning_result"("channel", "createdAt");
