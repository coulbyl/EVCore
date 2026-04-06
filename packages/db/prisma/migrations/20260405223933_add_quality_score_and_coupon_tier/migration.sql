-- CreateEnum
CREATE TYPE "CouponTier" AS ENUM ('PREMIUM', 'STANDARD', 'SPECULATIF');

-- AlterTable
ALTER TABLE "bet" ADD COLUMN     "qualityScore" DECIMAL(6,4);

-- AlterTable
ALTER TABLE "daily_coupon" ADD COLUMN     "tier" "CouponTier";
