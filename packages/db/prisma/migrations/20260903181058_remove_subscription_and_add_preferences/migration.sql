/*
  Warnings:

  - You are about to drop the `subscription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subscription_event` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RiskProfile" AS ENUM ('CONSERVATIVE', 'BALANCED', 'AGGRESSIVE');

-- DropForeignKey
ALTER TABLE "subscription" DROP CONSTRAINT "subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "subscription_event" DROP CONSTRAINT "subscription_event_channelSelectionId_fkey";

-- DropForeignKey
ALTER TABLE "subscription_event" DROP CONSTRAINT "subscription_event_couponProposalId_fkey";

-- DropForeignKey
ALTER TABLE "subscription_event" DROP CONSTRAINT "subscription_event_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "riskProfile" "RiskProfile" NOT NULL DEFAULT 'BALANCED';

-- DropTable
DROP TABLE "subscription";

-- DropTable
DROP TABLE "subscription_event";

-- DropEnum
DROP TYPE "subscription_channel_pick_mode";

-- DropEnum
DROP TYPE "subscription_source_type";

-- DropEnum
DROP TYPE "subscription_status";

-- CreateTable
CREATE TABLE "user_followed_channel" (
    "userId" UUID NOT NULL,
    "channel" "StrategyChannel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_followed_channel_pkey" PRIMARY KEY ("userId","channel")
);

-- CreateTable
CREATE TABLE "user_followed_league" (
    "userId" UUID NOT NULL,
    "competitionCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_followed_league_pkey" PRIMARY KEY ("userId","competitionCode")
);

-- AddForeignKey
ALTER TABLE "user_followed_channel" ADD CONSTRAINT "user_followed_channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_followed_league" ADD CONSTRAINT "user_followed_league_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_followed_league" ADD CONSTRAINT "user_followed_league_competitionCode_fkey" FOREIGN KEY ("competitionCode") REFERENCES "competition"("code") ON DELETE CASCADE ON UPDATE CASCADE;
