-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('FOOTBALL');

-- CreateEnum
CREATE TYPE "StrategyChannel" AS ENUM ('EV', 'SAFE', 'DOMINANT', 'BTTS', 'DRAW', 'GOALS', 'FIRST_HALF', 'DOUBLE_CHANCE', 'UNDERDOG', 'FAVORITE', 'LIVE_VALUE', 'MARKET_MOVE', 'CONSENSUS', 'CONTRARIAN', 'AVOID');

-- CreateEnum
CREATE TYPE "ChannelDecisionStatus" AS ENUM ('SELECTED', 'REJECTED', 'DISABLED', 'INSUFFICIENT_DATA', 'MISSING_ODDS', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "bet" ADD COLUMN     "channelSelectionId" UUID;

-- AlterTable
ALTER TABLE "competition" ADD COLUMN     "sport" "SportType" NOT NULL DEFAULT 'FOOTBALL';

-- CreateTable
CREATE TABLE "channel_decision" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "modelRunId" UUID NOT NULL,
    "channel" "StrategyChannel" NOT NULL,
    "status" "ChannelDecisionStatus" NOT NULL,
    "reasonCode" TEXT,
    "reasonDetails" JSONB,
    "configVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_selection" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "channelDecisionId" UUID NOT NULL,
    "market" "Market" NOT NULL,
    "pick" TEXT NOT NULL,
    "comboMarket" "Market",
    "comboPick" TEXT,
    "probability" DECIMAL(5,4) NOT NULL,
    "odds" DECIMAL(6,3),
    "impliedProbability" DECIMAL(5,4),
    "ev" DECIMAL(6,4),
    "qualityScore" DECIMAL(6,4),
    "rank" INTEGER NOT NULL DEFAULT 1,
    "result" "BetStatus",
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_selection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_decision_modelRunId_idx" ON "channel_decision"("modelRunId");

-- CreateIndex
CREATE INDEX "channel_decision_channel_status_createdAt_idx" ON "channel_decision"("channel", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "channel_decision_modelRunId_channel_key" ON "channel_decision"("modelRunId", "channel");

-- CreateIndex
CREATE INDEX "channel_selection_market_result_createdAt_idx" ON "channel_selection"("market", "result", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "channel_selection_channelDecisionId_rank_key" ON "channel_selection"("channelDecisionId", "rank");

-- AddForeignKey
ALTER TABLE "bet" ADD CONSTRAINT "bet_channelSelectionId_fkey" FOREIGN KEY ("channelSelectionId") REFERENCES "channel_selection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_decision" ADD CONSTRAINT "channel_decision_modelRunId_fkey" FOREIGN KEY ("modelRunId") REFERENCES "model_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_selection" ADD CONSTRAINT "channel_selection_channelDecisionId_fkey" FOREIGN KEY ("channelDecisionId") REFERENCES "channel_decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
