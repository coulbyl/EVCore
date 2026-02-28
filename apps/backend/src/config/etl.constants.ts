// ETL configuration constants — never hardcode these inline

export const ETL_CONSTANTS = {
  // --- API-FOOTBALL (single provider for fixtures, results, future odds) ---
  API_FOOTBALL_BASE: 'https://v3.football.api-sports.io',
  // Pro plan: 7 500 req/day — keep conservative staggering between season jobs
  API_FOOTBALL_RATE_LIMIT_MS: 6_000,

  EPL_LEAGUE_ID: 39,
  EPL_COMPETITION_CODE: 'PL',
  EPL_COMPETITION_NAME: 'Premier League',
  EPL_COMPETITION_COUNTRY: 'England',
  // API-FOOTBALL season format: starting year (2022 = 2022/23, 2023 = 2023/24, 2024 = 2024/25)
  EPL_SEASONS: [2022, 2023, 2024] as const,
  // Delay between /fixtures/statistics calls within a stats-sync job (per fixture)
  STATS_RATE_LIMIT_MS: 2_000,
  // xG proxy: shots on target × this factor — calibrate after 50+ bets (see EVCORE.md §4.1)
  XG_SHOTS_CONVERSION_FACTOR: 0.35,

  // --- football-data.co.uk CSV — historical odds one-shot import ---
  // Closing odds (Pinnacle + Bet365) for EV backtest. Free, no auth required.
  CSV_ODDS_BASE: 'https://www.football-data.co.uk/mmz4281',
  // Season codes in football-data.co.uk format (YYZZ)
  CSV_ODDS_SEASONS: ['2122', '2223', '2324', '2425'] as const,
} as const;

export const BULLMQ_QUEUES = {
  FIXTURES_SYNC: 'fixtures-sync',
  RESULTS_SYNC: 'results-sync',
  STATS_SYNC: 'stats-sync',
  ODDS_CSV_IMPORT: 'odds-csv-import',
} as const;

export const BULLMQ_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

// Cron schedules for daily/weekly ETL automation (BullMQ repeatable jobs)
export const ETL_CRON_SCHEDULES = {
  FIXTURES_SYNC: '0 2 * * *',   // 02:00 UTC daily
  RESULTS_SYNC: '0 3 * * *',    // 03:00 UTC daily
  STATS_SYNC: '0 4 * * *',      // 04:00 UTC daily
  ODDS_CSV_IMPORT: '0 5 * * 1', // 05:00 UTC every Monday
} as const;

// Stable keys for upsertJobScheduler — one per queue (idempotent on restart)
export const ETL_SCHEDULER_KEYS = {
  FIXTURES_SYNC: 'cron:fixtures-sync',
  RESULTS_SYNC: 'cron:results-sync',
  STATS_SYNC: 'cron:stats-sync',
  ODDS_CSV_IMPORT: 'cron:odds-csv-import',
} as const;
