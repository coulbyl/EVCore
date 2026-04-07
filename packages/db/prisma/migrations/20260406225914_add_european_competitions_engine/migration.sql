-- CreateEnum
CREATE TYPE "OddsSnapshotSource" AS ENUM ('PREMATCH', 'HISTORICAL');

-- AlterTable
ALTER TABLE "fixture" ADD COLUMN     "aggregateAwayGoals" INTEGER,
ADD COLUMN     "aggregateHomeGoals" INTEGER,
ADD COLUMN     "leg" INTEGER,
ADD COLUMN     "round" TEXT;

-- AlterTable
ALTER TABLE "odds_snapshot" ADD COLUMN     "source" "OddsSnapshotSource" NOT NULL DEFAULT 'PREMATCH';

-- CreateIndex
CREATE INDEX "fixture_seasonId_round_idx" ON "fixture"("seasonId", "round");
