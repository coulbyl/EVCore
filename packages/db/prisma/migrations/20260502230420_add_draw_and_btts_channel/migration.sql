/*
  Warnings:

  - A unique constraint covering the columns `[fixtureId,channel]` on the table `prediction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PredictionChannel" AS ENUM ('CONF', 'DRAW', 'BTTS');

-- DropIndex
DROP INDEX "prediction_competition_createdAt_idx";

-- DropIndex
DROP INDEX "prediction_fixtureId_key";

-- AlterTable
ALTER TABLE "prediction" ADD COLUMN     "channel" "PredictionChannel" NOT NULL DEFAULT 'CONF';

-- CreateIndex
CREATE INDEX "prediction_competition_channel_createdAt_idx" ON "prediction"("competition", "channel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_fixtureId_channel_key" ON "prediction"("fixtureId", "channel");
