-- Migration: add_daily_coupon
-- Adds CouponStatus enum, DailyCoupon table, combo/coupon FK fields on Bet,
-- and extends NotificationType with DAILY_COUPON and NO_BET_TODAY.

-- 1. Extend NotificationType enum
DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DAILY_COUPON';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NO_BET_TODAY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create CouponStatus enum
CREATE TYPE "CouponStatus" AS ENUM ('PENDING', 'SETTLED', 'NO_BET');

-- 3. Create daily_coupon table
CREATE TABLE "daily_coupon" (
    "id"        UUID          NOT NULL DEFAULT uuidv7(),
    "date"      DATE          NOT NULL,
    "status"    "CouponStatus" NOT NULL DEFAULT 'PENDING',
    "legCount"  INTEGER       NOT NULL,
    "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_coupon_date_key" ON "daily_coupon"("date");

-- 4. Add combo fields and coupon FK to Bet
ALTER TABLE "Bet" ADD COLUMN "comboMarket"   "Market";
ALTER TABLE "Bet" ADD COLUMN "comboPick"     TEXT;
ALTER TABLE "Bet" ADD COLUMN "dailyCouponId" UUID;

-- 5. FK constraint
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_dailyCouponId_fkey"
    FOREIGN KEY ("dailyCouponId") REFERENCES "daily_coupon"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Index on dailyCouponId
CREATE INDEX "Bet_dailyCouponId_idx" ON "Bet"("dailyCouponId");
