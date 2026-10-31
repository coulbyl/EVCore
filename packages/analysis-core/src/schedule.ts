/**
 * The evening coupon pass, shared by apps/backend and apps/vantage-worker
 * (docs/audits/2026-10-29/ENV-PROD.md § 3). Every coupon of a day is
 * composed by the backend's 17:00 UTC horizon pass (odds, then analysis of
 * the next day, then the generators); the LLM combo reads the same pool 45
 * minutes later. One constant, so moving one pass cannot silently leave the
 * other reading a day not analysed yet.
 */
export const COUPON_SCHEDULE = {
  /** apps/backend ETL_CRON_SCHEDULES.ROLLING_HORIZON. */
  HORIZON_PASS_CRON: "0 17 * * *",
  /** apps/vantage-worker's daily coupon generation. */
  LLM_COUPON_CRON: "45 17 * * *",
} as const;
