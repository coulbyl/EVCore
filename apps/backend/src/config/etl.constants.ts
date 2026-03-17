// ETL configuration constants — never hardcode these inline

import { activeSeasons } from '@utils/date.utils';

// Defaults shared by leagues with standard Europe-like calendar.
// Override only when a league has a different season rhythm.
export const DEFAULT_SEASON_START_MONTH = 7; // August (0-indexed)
export const DEFAULT_ACTIVE_SEASONS_COUNT = 3;

export type ApiFootballDailyCallsEstimateInput = {
  leagueCount: number;
  seasonJobCount: number;
  avgScheduledFixturesPerLeaguePerDay: number;
  avgFinishedFixturesWithoutXgPerLeaguePerDay: number;
};

export type ApiFootballDailyCallsEstimate = {
  leagueCount: number;
  seasonJobCount: number;
  fixturesSyncCalls: number;
  settlementSyncCalls: number;
  statsSyncCalls: number;
  injuriesSyncCalls: number;
  oddsLiveSyncCalls: number;
  totalCalls: number;
};

export function estimateApiFootballDailyCalls(
  input: ApiFootballDailyCallsEstimateInput,
): ApiFootballDailyCallsEstimate {
  const { leagueCount, seasonJobCount } = input;

  const avgScheduled = Math.max(
    0,
    Math.floor(input.avgScheduledFixturesPerLeaguePerDay),
  );
  const avgFinishedWithoutXg = Math.max(
    0,
    Math.floor(input.avgFinishedFixturesWithoutXgPerLeaguePerDay),
  );

  // Daily calls by worker class:
  // - fixtures are season-level calls
  // - settlement/stats/injuries/odds-prematch are fixture-level calls
  const fixturesSyncCalls = seasonJobCount;
  const settlementSyncCalls = Math.max(1, Math.floor(leagueCount / 2));
  const statsSyncCalls = leagueCount * avgFinishedWithoutXg;
  const injuriesSyncCalls = leagueCount * avgScheduled;
  const oddsLiveSyncCalls = leagueCount * avgScheduled;

  const totalCalls =
    fixturesSyncCalls +
    settlementSyncCalls +
    statsSyncCalls +
    injuriesSyncCalls +
    oddsLiveSyncCalls;

  return {
    leagueCount,
    seasonJobCount,
    fixturesSyncCalls,
    settlementSyncCalls,
    statsSyncCalls,
    injuriesSyncCalls,
    oddsLiveSyncCalls,
    totalCalls,
  };
}

export const ETL_CONSTANTS = {
  // --- API-FOOTBALL (single provider for fixtures, results, future odds) ---
  API_FOOTBALL_BASE: 'https://v3.football.api-sports.io',
  // Pro plan: 7 500 req/day — keep conservative staggering between season jobs
  API_FOOTBALL_RATE_LIMIT_MS: 6_000,
  // Delay between /fixtures/statistics calls within a stats-sync job (per fixture)
  STATS_RATE_LIMIT_MS: 2_000,
  // Fallback xG proxy when expected_goals is absent from the API response.
  // Used for 2022-23 first half where API-Football did not yet track xG.
  XG_SHOTS_PROXY_FACTOR: 0.35,

  // --- football-data.co.uk CSV — historical odds one-shot import ---
  // Closing odds (Pinnacle + Bet365) for EV backtest. Free, no auth required.
  CSV_ODDS_BASE: 'https://www.football-data.co.uk/mmz4281',
} as const;

// Returns the last DEFAULT_ACTIVE_SEASONS_COUNT season codes in football-data.co.uk
// format (YYZZ), derived dynamically from activeSeasons() — same window as fixtures.
// Example: 2026-03 → ['2324', '2425', '2526']
export function getActiveCsvSeasonCodes(now: Date = new Date()): string[] {
  return activeSeasons(
    DEFAULT_SEASON_START_MONTH,
    DEFAULT_ACTIVE_SEASONS_COUNT,
    now,
  ).map((y) => `${String(y).slice(2)}${String(y + 1).slice(2)}`);
}

// Bookmaker IDs in the API-Football odds endpoint
export const API_FOOTBALL_BOOKMAKERS = {
  PINNACLE: 4,
  BET365: 8,
  UNIBET: 16,
  MARATHONBET: 2,
  BWIN: 6,
} as const;

// Bet type IDs in the API-Football odds endpoint
export const API_FOOTBALL_BET_IDS = {
  MATCH_WINNER: 1,
  OVER_UNDER_25: 5,
  BTTS: 8,
  HALF_TIME_FULL_TIME: 18,
} as const;

export const BULLMQ_QUEUES = {
  LEAGUE_SYNC: 'league-sync',
  PENDING_BETS_SETTLEMENT: 'pending-bets-settlement-sync',
  ODDS_CSV_IMPORT: 'odds-csv-import',
  ODDS_PREMATCH_SYNC: 'odds-prematch-sync',
  ODDS_SNAPSHOT_RETENTION: 'odds-snapshot-retention',
  BETTING_ENGINE: 'betting-engine',
} as const;

export const BULLMQ_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

// Cron schedules for daily/weekly ETL automation (BullMQ repeatable jobs)
export const ETL_CRON_SCHEDULES = {
  FIXTURES_SYNC: '0 2 * * *', // 02:00 UTC daily
  PENDING_BETS_SETTLEMENT: '*/30 * * * *', // every 30 minutes
  STATS_SYNC: '0 4 * * *', // 04:00 UTC daily
  INJURIES_SYNC: '0 6 * * *', // 06:00 UTC daily — shadow injuries refresh
  ODDS_CSV_IMPORT: '0 5 * * 1', // 05:00 UTC every Monday
  ODDS_PREMATCH_SYNC: '0 18 * * *', // 18:00 UTC daily — pre-match snapshot for next day
  ODDS_SNAPSHOT_RETENTION: '30 6 * * *', // 06:30 UTC daily — purge stale odds snapshots
} as const;

// Stable keys for upsertJobScheduler — one per queue (idempotent on restart)
export const ETL_SCHEDULER_KEYS = {
  LEAGUE_SYNC: 'cron:league-sync',
  PENDING_BETS_SETTLEMENT: 'cron:pending-bets-settlement',
  ODDS_CSV_IMPORT: 'cron:odds-csv-import',
  ODDS_PREMATCH_SYNC: 'cron:odds-prematch-sync',
  ODDS_SNAPSHOT_RETENTION: 'cron:odds-snapshot-retention',
} as const;
