-- AlterEnum
ALTER TYPE "CouponTier" ADD VALUE 'SAFE';

-- AlterTable
ALTER TABLE "bet" ADD COLUMN     "isSafeValue" BOOLEAN NOT NULL DEFAULT false;
