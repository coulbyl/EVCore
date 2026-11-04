-- The clock of a match in progress (API-Football fixture.status.short and
-- fixture.status.elapsed), written by the settlement pass with the live
-- score, so the coupons of Aujourd'hui show « 67' » or « MT ». Null once
-- the match is no longer in progress.

-- AlterTable
ALTER TABLE "public"."fixture" ADD COLUMN     "liveElapsed" INTEGER,
ADD COLUMN     "liveStatus" TEXT;
