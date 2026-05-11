-- CreateEnum
CREATE TYPE "coupon_leg_canal" AS ENUM ('EV', 'SV', 'BB', 'NUL', 'CONF');

-- CreateEnum
CREATE TYPE "coupon_proposal_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "coupon_result" AS ENUM ('WON', 'LOST', 'PARTIAL', 'VOID');

-- CreateTable
CREATE TABLE "coupon_proposal" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "forDate" DATE NOT NULL,
    "signalWindowDays" INTEGER NOT NULL,
    "targetOddsMin" DECIMAL(6,2) NOT NULL,
    "targetOddsMax" DECIMAL(6,2) NOT NULL,
    "combinedOdds" DECIMAL(8,3) NOT NULL,
    "jointProbability" DECIMAL(5,4) NOT NULL,
    "signalScore" DECIMAL(5,4) NOT NULL,
    "status" "coupon_proposal_status" NOT NULL DEFAULT 'PENDING',
    "result" "coupon_result",
    "reasoning" JSONB,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "lastFixtureScheduledAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_proposal_leg" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "couponProposalId" UUID NOT NULL,
    "fixtureId" UUID NOT NULL,
    "canal" "coupon_leg_canal" NOT NULL,
    "market" "Market" NOT NULL,
    "pick" TEXT NOT NULL,
    "probability" DECIMAL(5,4) NOT NULL,
    "oddsSnapshot" DECIMAL(6,3),
    "signalScore" DECIMAL(5,4) NOT NULL,
    "featureSnapshot" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_proposal_leg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_proposal_forDate_status_idx" ON "coupon_proposal"("forDate", "status");

-- CreateIndex
CREATE INDEX "coupon_proposal_status_lastFixtureScheduledAt_idx" ON "coupon_proposal"("status", "lastFixtureScheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_proposal_forDate_signalWindowDays_targetOddsMin_targ_key" ON "coupon_proposal"("forDate", "signalWindowDays", "targetOddsMin", "targetOddsMax", "rank");

-- CreateIndex
CREATE INDEX "coupon_proposal_leg_couponProposalId_idx" ON "coupon_proposal_leg"("couponProposalId");

-- CreateIndex
CREATE INDEX "coupon_proposal_leg_fixtureId_idx" ON "coupon_proposal_leg"("fixtureId");

-- AddForeignKey
ALTER TABLE "coupon_proposal_leg" ADD CONSTRAINT "coupon_proposal_leg_couponProposalId_fkey" FOREIGN KEY ("couponProposalId") REFERENCES "coupon_proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_proposal_leg" ADD CONSTRAINT "coupon_proposal_leg_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
