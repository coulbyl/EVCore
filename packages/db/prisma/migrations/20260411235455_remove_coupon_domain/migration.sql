/*
  Warnings:

  - The values [DAILY_COUPON,NO_BET_TODAY,COUPON_RESULT] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dailyCouponId` on the `bet` table. All the data in the column will be lost.
  - You are about to drop the `coupon_leg` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `daily_coupon` table. If the table is not empty, all the data it contains will be lost.

*/
-- Delete notifications with coupon-related types before altering the enum
DELETE FROM "notification" WHERE "type" IN ('DAILY_COUPON', 'NO_BET_TODAY', 'COUPON_RESULT');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ROI_ALERT', 'MARKET_SUSPENSION', 'BRIER_ALERT', 'WEEKLY_REPORT', 'ETL_FAILURE', 'WEIGHT_ADJUSTMENT', 'XG_UNAVAILABLE_REPORT');
ALTER TABLE "notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "bet" DROP CONSTRAINT "bet_dailyCouponId_fkey";

-- DropForeignKey
ALTER TABLE "coupon_leg" DROP CONSTRAINT "coupon_leg_betId_fkey";

-- DropForeignKey
ALTER TABLE "coupon_leg" DROP CONSTRAINT "coupon_leg_couponId_fkey";

-- DropIndex
DROP INDEX "bet_dailyCouponId_idx";

-- AlterTable
ALTER TABLE "bet" DROP COLUMN "dailyCouponId";

-- DropTable
DROP TABLE "coupon_leg";

-- DropTable
DROP TABLE "daily_coupon";

-- DropEnum
DROP TYPE "CouponStatus";

-- DropEnum
DROP TYPE "CouponTier";
