import Decimal from 'decimal.js';
import { CouponTier } from '@evcore/db';

// Maximum number of legs per coupon — pool is split into chunks of this size.
export const COUPON_MAX_LEGS = 3;
export const COUPON_WINDOW_MIN_DAYS = 1;
export const COUPON_WINDOW_MAX_DAYS = 3;

// Daily coupon generation cron — 20:00 UTC (picks for the next day).
export const COUPON_CRON_SCHEDULE = '0 20 * * *';

// Stable BullMQ scheduler key for the coupon worker (idempotent on restart).
export const COUPON_SCHEDULER_KEY = 'cron:betting-engine';

// Adverse line movement threshold: if odds drop by >10% over 7 days, exclude the pick.
export const LINE_MOVEMENT_THRESHOLD = new Decimal('0.10');

// Tier thresholds — based on the average qualityScore of the coupon's legs.
// qualityScore = EV × deterministicScore (null for legacy bets → treated as 0).
export const COUPON_TIER_THRESHOLDS: { threshold: number; tier: CouponTier }[] =
  [
    { threshold: 0.22, tier: CouponTier.PREMIUM },
    { threshold: 0.13, tier: CouponTier.STANDARD },
    { threshold: 0, tier: CouponTier.SPECULATIF },
  ];

export function resolveCouponTier(avgQualityScore: number): CouponTier {
  for (const { threshold, tier } of COUPON_TIER_THRESHOLDS) {
    if (avgQualityScore >= threshold) return tier;
  }
  return CouponTier.SPECULATIF;
}
