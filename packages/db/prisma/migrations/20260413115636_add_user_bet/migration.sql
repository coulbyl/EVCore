/*
  Warnings:

  - A unique constraint covering the columns `[fixtureId,pickKey,userId]` on the table `bet` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BetSource" AS ENUM ('MODEL', 'USER');

-- DropIndex
DROP INDEX "bet_fixtureId_pickKey_key";

-- AlterTable
ALTER TABLE "bet" ADD COLUMN     "source" "BetSource" NOT NULL DEFAULT 'MODEL',
ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE INDEX "bet_userId_idx" ON "bet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bet_fixtureId_pickKey_userId_key" ON "bet"("fixtureId", "pickKey", "userId");

-- AddForeignKey
ALTER TABLE "bet" ADD CONSTRAINT "bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
