// ETL configuration constants — never hardcode these inline
// See EVCORE.md §14.2 for rate limit rationale

export const ETL_CONSTANTS = {
  FOOTBALL_DATA_API_BASE: 'https://api.football-data.org/v4',
  // Free tier: 10 req/min → 1 req/6s to be safe
  FOOTBALL_DATA_RATE_LIMIT_MS: 6_000,

  UNDERSTAT_BASE: 'https://understat.com/league/EPL',
  // Understat: no official limit — 1 req/3s
  UNDERSTAT_RATE_LIMIT_MS: 3_000,

  FBREF_BASE: 'https://fbref.com/en/comps/9',
  // FBref: strict anti-scraping — 1 req/3s minimum
  FBREF_RATE_LIMIT_MS: 3_000,

  EPL_COMPETITION_CODE: 'PL',
  EPL_COMPETITION_NAME: 'Premier League',
  EPL_COMPETITION_COUNTRY: 'England',
  // 3 historical seasons for initial import and backtest
  EPL_SEASONS: [2021, 2022, 2023] as const,
} as const;

export const BULLMQ_QUEUES = {
  FIXTURES_SYNC: 'fixtures-sync',
  RESULTS_SYNC: 'results-sync',
  XG_SYNC: 'xg-sync',
  STATS_SYNC: 'stats-sync',
} as const;

export const BULLMQ_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;
