-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('BET', 'NO_BET');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('ONE_X_TWO', 'OVER_UNDER', 'BTTS', 'DOUBLE_CHANCE');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'FROZEN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ROI_ALERT', 'MARKET_SUSPENSION', 'BRIER_ALERT', 'WEEKLY_REPORT', 'ETL_FAILURE', 'WEIGHT_ADJUSTMENT');

-- CreateTable
CREATE TABLE "Competition" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "competitionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "competitionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
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
    "homeXg" DECIMAL(5,3),
    "awayXg" DECIMAL(5,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStats" (
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

    CONSTRAINT "TeamStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelRun" (
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

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "modelRunId" UUID NOT NULL,
    "market" "Market" NOT NULL,
    "pick" TEXT NOT NULL,
    "probEstimated" DECIMAL(5,4) NOT NULL,
    "oddsSnapshot" DECIMAL(6,3),
    "ev" DECIMAL(6,4) NOT NULL,
    "stakePct" DECIMAL(5,4) NOT NULL,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentProposal" (
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

    CONSTRAINT "AdjustmentProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSuspension" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "market" "Market" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'auto',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSuspension_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "OddsSnapshot" (
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

    CONSTRAINT "OddsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competition_code_key" ON "Competition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Season_competitionId_name_key" ON "Season"("competitionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_externalId_key" ON "Team"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_externalId_key" ON "Fixture"("externalId");

-- CreateIndex
CREATE INDEX "Fixture_seasonId_matchday_idx" ON "Fixture"("seasonId", "matchday");

-- CreateIndex
CREATE INDEX "Fixture_scheduledAt_idx" ON "Fixture"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamStats_teamId_afterFixtureId_key" ON "TeamStats"("teamId", "afterFixtureId");

-- CreateIndex
CREATE INDEX "ModelRun_fixtureId_idx" ON "ModelRun"("fixtureId");

-- CreateIndex
CREATE INDEX "Bet_modelRunId_idx" ON "Bet"("modelRunId");

-- CreateIndex
CREATE INDEX "MarketSuspension_market_active_idx" ON "MarketSuspension"("market", "active");

-- CreateIndex
CREATE INDEX "notification_read_createdAt_idx" ON "notification"("read", "createdAt");

-- CreateIndex
CREATE INDEX "OddsSnapshot_fixtureId_snapshotAt_idx" ON "OddsSnapshot"("fixtureId", "snapshotAt");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStats" ADD CONSTRAINT "TeamStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStats" ADD CONSTRAINT "TeamStats_afterFixtureId_fkey" FOREIGN KEY ("afterFixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "ModelRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddsSnapshot" ADD CONSTRAINT "OddsSnapshot_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
