-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('BET', 'NO_BET');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('ONE_X_TWO', 'OVER_UNDER', 'BTTS', 'DOUBLE_CHANCE', 'HALF_TIME_FULL_TIME');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'FROZEN');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'SETTLED', 'NO_BET');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ROI_ALERT', 'MARKET_SUSPENSION', 'BRIER_ALERT', 'WEEKLY_REPORT', 'ETL_FAILURE', 'WEIGHT_ADJUSTMENT', 'XG_UNAVAILABLE_REPORT', 'DAILY_COUPON', 'NO_BET_TODAY', 'COUPON_RESULT');

-- CreateTable
CREATE TABLE "competition" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "leagueId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "csvDivisionCode" TEXT,
    "seasonStartMonth" INTEGER,
    "activeSeasonsCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "competitionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "competitionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixture" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "externalId" INTEGER NOT NULL,
    "seasonId" UUID NOT NULL,
    "homeTeamId" UUID NOT NULL,
    "awayTeamId" UUID NOT NULL,
    "matchday" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "homeHtScore" INTEGER,
    "awayHtScore" INTEGER,
    "homeXg" DECIMAL(5,3),
    "awayXg" DECIMAL(5,3),
    "xgUnavailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_stats" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "teamId" UUID NOT NULL,
    "afterFixtureId" UUID NOT NULL,
    "recentForm" DECIMAL(5,4) NOT NULL,
    "xgFor" DECIMAL(5,3) NOT NULL,
    "xgAgainst" DECIMAL(5,3) NOT NULL,
    "homeWinRate" DECIMAL(5,4) NOT NULL,
    "awayWinRate" DECIMAL(5,4) NOT NULL,
    "drawRate" DECIMAL(5,4) NOT NULL,
    "leagueVolatility" DECIMAL(5,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_run" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" "Decision" NOT NULL,
    "deterministicScore" DECIMAL(5,4) NOT NULL,
    "llmDelta" DECIMAL(5,4),
    "finalScore" DECIMAL(5,4) NOT NULL,
    "features" JSONB NOT NULL,
    "openclawRaw" JSONB,
    "validatedByBackend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bet" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "modelRunId" UUID NOT NULL,
    "market" "Market" NOT NULL,
    "pick" TEXT NOT NULL,
    "probEstimated" DECIMAL(5,4) NOT NULL,
    "oddsSnapshot" DECIMAL(6,3),
    "ev" DECIMAL(6,4) NOT NULL,
    "stakePct" DECIMAL(5,4) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "comboMarket" "Market",
    "comboPick" TEXT,
    "dailyCouponId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_coupon" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "date" DATE NOT NULL,
    "status" "CouponStatus" NOT NULL DEFAULT 'PENDING',
    "legCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjustment_proposal" (
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
CREATE TABLE "market_suspension" (
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

-- CreateTable
CREATE TABLE "odds_snapshot" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "fixtureId" UUID NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "homeOdds" DECIMAL(6,3),
    "drawOdds" DECIMAL(6,3),
    "awayOdds" DECIMAL(6,3),
    "pick" TEXT,
    "odds" DECIMAL(6,3),
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competition_leagueId_key" ON "competition"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_code_key" ON "competition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "season_competitionId_name_key" ON "season"("competitionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "team_externalId_key" ON "team"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_externalId_key" ON "fixture"("externalId");

-- CreateIndex
CREATE INDEX "fixture_seasonId_matchday_idx" ON "fixture"("seasonId", "matchday");

-- CreateIndex
CREATE INDEX "fixture_scheduledAt_idx" ON "fixture"("scheduledAt");

-- CreateIndex
CREATE INDEX "fixture_status_scheduledAt_idx" ON "fixture"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "fixture_seasonId_status_scheduledAt_idx" ON "fixture"("seasonId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "fixture_homeTeamId_status_scheduledAt_idx" ON "fixture"("homeTeamId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "fixture_awayTeamId_status_scheduledAt_idx" ON "fixture"("awayTeamId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "team_stats_teamId_afterFixtureId_key" ON "team_stats"("teamId", "afterFixtureId");

-- CreateIndex
CREATE INDEX "model_run_fixtureId_idx" ON "model_run"("fixtureId");

-- CreateIndex
CREATE INDEX "model_run_fixtureId_analyzedAt_idx" ON "model_run"("fixtureId", "analyzedAt");

-- CreateIndex
CREATE INDEX "bet_modelRunId_idx" ON "bet"("modelRunId");

-- CreateIndex
CREATE INDEX "bet_dailyCouponId_idx" ON "bet"("dailyCouponId");

-- CreateIndex
CREATE INDEX "bet_market_status_createdAt_idx" ON "bet"("market", "status", "createdAt");

-- CreateIndex
CREATE INDEX "bet_status_updatedAt_idx" ON "bet"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_coupon_date_key" ON "daily_coupon"("date");

-- CreateIndex
CREATE INDEX "adjustment_proposal_status_appliedAt_idx" ON "adjustment_proposal"("status", "appliedAt");

-- CreateIndex
CREATE INDEX "adjustment_proposal_createdAt_idx" ON "adjustment_proposal"("createdAt");

-- CreateIndex
CREATE INDEX "market_suspension_market_active_idx" ON "market_suspension"("market", "active");

-- CreateIndex
CREATE INDEX "notification_read_createdAt_idx" ON "notification"("read", "createdAt");

-- CreateIndex
CREATE INDEX "odds_snapshot_fixtureId_snapshotAt_idx" ON "odds_snapshot"("fixtureId", "snapshotAt");

-- CreateIndex
CREATE INDEX "odds_snapshot_fixtureId_bookmaker_market_pick_snapshotAt_idx" ON "odds_snapshot"("fixtureId", "bookmaker", "market", "pick", "snapshotAt");

-- CreateIndex
CREATE INDEX "odds_snapshot_snapshotAt_idx" ON "odds_snapshot"("snapshotAt");

-- AddForeignKey
ALTER TABLE "season" ADD CONSTRAINT "season_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture" ADD CONSTRAINT "fixture_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture" ADD CONSTRAINT "fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixture" ADD CONSTRAINT "fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_stats" ADD CONSTRAINT "team_stats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_stats" ADD CONSTRAINT "team_stats_afterFixtureId_fkey" FOREIGN KEY ("afterFixtureId") REFERENCES "fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_run" ADD CONSTRAINT "model_run_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet" ADD CONSTRAINT "bet_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "model_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bet" ADD CONSTRAINT "bet_dailyCouponId_fkey" FOREIGN KEY ("dailyCouponId") REFERENCES "daily_coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_snapshot" ADD CONSTRAINT "odds_snapshot_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
