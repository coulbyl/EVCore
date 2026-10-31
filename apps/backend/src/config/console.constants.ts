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

/**
 * « Les passes d'aujourd'hui » (12-admin.md § 1): the day's scheduled
 * passes, in the order of the day. Each reads its time from the cron it
 * runs on (console-passes.spec.ts checks they agree), its queue, and the
 * name of its jobs. `relaunch: false` for the morning brief: a second run
 * would write to every player again (maquette AdminMobile: no Relancer).
 */
export type ConsolePassKey =
  | 'stats'
  | 'odds_morning'
  | 'morning_brief'
  | 'coupons'
  | 'ai_combo'
  | 'odds_evening'
  | 'analysis';

export const CONSOLE_PASSES: readonly {
  key: ConsolePassKey;
  /** UTC hour and minute, as in the cron it runs on. */
  at: { hour: number; minute: number };
  queue: string;
  /** Its jobs' name, or the start of it (one stats job per league). */
  job: { name: string } | { prefix: string };
  relaunch: boolean;
}[] = [
  {
    key: 'stats',
    at: { hour: 4, minute: 0 },
    queue: 'league-sync',
    job: { prefix: 'stats-sync-' },
    relaunch: true,
  },
  {
    key: 'odds_morning',
    at: { hour: 6, minute: 0 },
    queue: 'odds-prematch-sync',
    job: { name: 'odds-prematch-sync' },
    relaunch: true,
  },
  {
    key: 'morning_brief',
    at: { hour: 8, minute: 0 },
    queue: 'slip-digest',
    job: { name: 'slip-digest' },
    relaunch: false,
  },
  {
    key: 'coupons',
    at: { hour: 17, minute: 0 },
    queue: 'rolling-horizon',
    job: { name: 'rolling-horizon' },
    relaunch: true,
  },
  {
    key: 'ai_combo',
    at: { hour: 17, minute: 45 },
    queue: 'vantage-analysis',
    job: { name: 'generate-coupons' },
    relaunch: true,
  },
  {
    key: 'odds_evening',
    at: { hour: 19, minute: 0 },
    queue: 'odds-prematch-sync',
    job: { name: 'odds-prematch-sync' },
    relaunch: true,
  },
  {
    key: 'analysis',
    at: { hour: 21, minute: 0 },
    queue: 'betting-engine',
    job: { name: 'betting-engine-analysis' },
    relaunch: true,
  },
];

/** A pass with nothing after its time plus this is « manquée ». */
export const CONSOLE_PASS_GRACE_MINUTES = 30;

/**
 * The lights are checked every ten minutes; a light turning red sends one
 * e-mail to RESEND_ADMIN_TO (12-admin.md § 1, tranché le 29/10).
 */
export const CONSOLE_WATCH = {
  QUEUE: 'console-watch',
  SCHEDULER_KEY: 'console-watch',
  JOB: 'console-watch',
  CRON: '*/10 * * * *',
  /** The admin home, linked from the e-mail (APP_URL + this). */
  HOME_PATH: '/admin',
} as const;

/**
 * Moteur › Canaux × compétition (12-admin.md § 2): 90 rolling days, the
 * ratio realised/announced with a 95 % interval. Below GOOD with the
 * interval's top under it too, the loss is established: an alert.
 */
export const CONSOLE_CALIBRATION = {
  WINDOW_DAYS: 90,
  GOOD_RATIO: 0.85,
  Z_95: 1.96,
} as const;
