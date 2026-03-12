import Decimal from 'decimal.js';

// Maximum number of legs in a daily coupon.
export const COUPON_MAX_LEGS = 6;
export const COUPON_WINDOW_MIN_DAYS = 1;
export const COUPON_WINDOW_MAX_DAYS = 3;

// Daily coupon generation cron — 20:00 UTC (picks for the next day).
export const COUPON_CRON_SCHEDULE = '0 20 * * *';

// Stable BullMQ scheduler key for the coupon worker (idempotent on restart).
export const COUPON_SCHEDULER_KEY = 'cron:betting-engine';

// Adverse line movement threshold: if odds drop by >10% over 7 days, exclude the pick.
export const LINE_MOVEMENT_THRESHOLD = new Decimal('0.10');
