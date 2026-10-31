/**
 * The admin's three lights and « À faire » (docs/refonte-ui/12-admin.md § 1):
 * each rule written once, here. Hours are elapsed hours; the deadline is
 * UTC, as the schedule (COUPON_SCHEDULE).
 */
export const CONSOLE_RULES = {
  /** Data, red: no odds snapshot for this long. */
  ODDS_STALE_HOURS: 24,
  /** Data, red: an ETL failure (a pass, the quota) this recent. */
  ETL_FAILURE_HOURS: 24,
  /** Data, orange: finished matches still without stats after this many days… */
  STATS_LATE_DAYS: 3,
  /** …looked for over this window… */
  STATS_LATE_WINDOW_DAYS: 10,
  /** …in competitions whose stats usually arrive (share over 60 days). */
  STATS_RELIABLE_WINDOW_DAYS: 60,
  STATS_RELIABLE_SHARE: 0.9,
  STATS_RELIABLE_MIN_FIXTURES: 10,
  /** Engine, red: tomorrow has no coupon after this UTC time. */
  COUPONS_DEADLINE_UTC: { hour: 17, minute: 30 },
  /** Engine, red: no analysis (model run) for this long. */
  ANALYSIS_STALE_HOURS: 26,
  /** Engine, orange: no AI opinion published for this long. */
  AI_STALE_HOURS: 24,
  /** Engine, « À faire »: a product absent this many days of the last week. */
  PRODUCT_ABSENT_DAYS: 3,
  PRODUCT_ABSENT_WINDOW_DAYS: 7,
  /** Players, red: nobody came back for this long. */
  PLAYERS_SILENT_HOURS: 48,
  /** Players, orange: a player's message unanswered for this long. */
  SUPPORT_UNANSWERED_HOURS: 24,
} as const;
