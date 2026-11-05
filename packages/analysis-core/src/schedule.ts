/**
 * The evening coupon pass (docs/audits/2026-10-29/ENV-PROD.md § 3): every
 * coupon of a day is composed by the backend's 17:00 UTC horizon pass (odds,
 * then analysis of the next day, then the generators). The LLM combo that
 * read the same pool at 17:45 was cut on 2026-11-03, replaced by the
 * Combiné IA (AI_COMBO_COUPON_CLASS). Since 2026-11-05 the Combiné IA alone
 * waits for the 21:00 UTC analysis pass, after VANTAGE has read the 17:00
 * runs (backend AI_COMBO_POLICY.composeFromHoursBeforeDay).
 */
export const COUPON_SCHEDULE = {
  /** apps/backend ETL_CRON_SCHEDULES.ROLLING_HORIZON. */
  HORIZON_PASS_CRON: "0 17 * * *",
} as const;
