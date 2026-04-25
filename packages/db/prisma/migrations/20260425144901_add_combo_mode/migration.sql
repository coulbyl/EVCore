-- CreateEnum
CREATE TYPE "BetSlipType" AS ENUM ('SIMPLE', 'COMBO');

-- DropIndex
DROP INDEX "bet_slip_item_userId_betId_key";

-- AlterTable
ALTER TABLE "bet_slip" ADD COLUMN     "type" "BetSlipType" NOT NULL DEFAULT 'SIMPLE';
