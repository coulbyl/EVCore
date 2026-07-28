-- CreateEnum
CREATE TYPE "subscription_source_type" AS ENUM ('COUPON_BEST', 'COUPON_ALL', 'CHANNEL_VALUE', 'CHANNEL_SAFE', 'CHANNEL_DOMINANT', 'CHANNEL_DRAW', 'CHANNEL_BTTS', 'CHANNEL_TEAM_TOTAL');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "subscription_channel_pick_mode" AS ENUM ('INVESTIR', 'DECISIONS');

-- CreateTable
CREATE TABLE "subscription" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "userId" UUID NOT NULL,
    "sourceType" "subscription_source_type" NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "channelPickMode" "subscription_channel_pick_mode",
    "topN" INTEGER,
    "stakePerEvent" DECIMAL(14,2) NOT NULL,
    "daysOfWeek" INTEGER[],
    "competitionCodes" TEXT[],
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "totalEvents" INTEGER NOT NULL DEFAULT 0,
    "settledEvents" INTEGER NOT NULL DEFAULT 0,
    "wonEvents" INTEGER NOT NULL DEFAULT 0,
    "totalStaked" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPnl" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_event" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "subscriptionId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "couponProposalId" UUID,
    "channelSelectionId" UUID,
    "stake" DECIMAL(14,2) NOT NULL,
    "odds" DECIMAL(6,3),
    "result" "BetStatus",
    "pnl" DECIMAL(14,2),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_userId_status_idx" ON "subscription"("userId", "status");

-- CreateIndex
CREATE INDEX "subscription_status_endDate_idx" ON "subscription"("status", "endDate");

-- CreateIndex
CREATE INDEX "subscription_event_subscriptionId_idx" ON "subscription_event"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_event_result_date_idx" ON "subscription_event"("result", "date");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_event_subscriptionId_date_couponProposalId_cha_key" ON "subscription_event"("subscriptionId", "date", "couponProposalId", "channelSelectionId");

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_event" ADD CONSTRAINT "subscription_event_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_event" ADD CONSTRAINT "subscription_event_couponProposalId_fkey" FOREIGN KEY ("couponProposalId") REFERENCES "coupon_proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_event" ADD CONSTRAINT "subscription_event_channelSelectionId_fkey" FOREIGN KEY ("channelSelectionId") REFERENCES "channel_selection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
