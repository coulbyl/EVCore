// ETL configuration constants — never hardcode these inline

import { activeSeasons } from '@utils/date.utils';

// Defaults shared by leagues with standard Europe-like calendar.
// Override only when a league has a different season rhythm.
export const DEFAULT_SEASON_START_MONTH = 7; // August (0-indexed)
export const DEFAULT_ACTIVE_SEASONS_COUNT = 3;

export type CompetitionConfig = {
  leagueId: number;
  code: string;
  name: string;
  country: string;
  isActive: boolean;
  // football-data.co.uk division code used for odds CSV import (e.g. E0, I1, SP1, D1)
  csvDivisionCode?: string;
  seasonStartMonth?: number;
  activeSeasonsCount?: number;
};

export const COMPETITIONS = {
  PL: {
    leagueId: 39,
    code: 'PL',
    name: 'Premier League',
    country: 'England',
    isActive: true,
    csvDivisionCode: 'E0',
  },
  SA: {
    leagueId: 135,
    code: 'SA',
    name: 'Serie A',
    country: 'Italy',
    isActive: false,
    csvDivisionCode: 'I1',
  },
  LL: {
    leagueId: 140,
    code: 'LL',
    name: 'La Liga',
    country: 'Spain',
    isActive: false,
    csvDivisionCode: 'SP1',
  },
  BL1: {
    leagueId: 78,
    code: 'BL1',
    name: 'Bundesliga',
    country: 'Germany',
    isActive: false,
    csvDivisionCode: 'D1',
  },
} as const satisfies Record<string, CompetitionConfig>;

export const ACTIVE_COMPETITIONS: readonly CompetitionConfig[] = Object.values(
  COMPETITIONS,
).filter((competition) => competition.isActive);

if (ACTIVE_COMPETITIONS.length === 0) {
  throw new Error(
    'No active competition configured. Set COMPETITIONS.<code>.isActive = true.',
  );
}

const COMPETITIONS_BY_CODE: Readonly<Record<string, CompetitionConfig>> =
  Object.fromEntries(
    Object.values(COMPETITIONS).map((competition) => [
      competition.code,
      competition,
    ]),
  );

export function getCompetitionByCodeOrThrow(code: string): CompetitionConfig {
  const competition = COMPETITIONS_BY_CODE[code];
  if (!competition) {
    throw new Error(`Unknown competition code: ${code}`);
  }
  return competition;
}

export function getCompetitionSeasons(
  competition: CompetitionConfig,
  now: Date = new Date(),
): readonly number[] {
  return activeSeasons(
    competition.seasonStartMonth ?? DEFAULT_SEASON_START_MONTH,
    competition.activeSeasonsCount ?? DEFAULT_ACTIVE_SEASONS_COUNT,
    now,
  );
}

export type ActiveCompetitionPlan = {
  competition: CompetitionConfig;
  seasons: readonly number[];
};

export function getActiveCompetitionPlans(
  now: Date = new Date(),
): readonly ActiveCompetitionPlan[] {
  return ACTIVE_COMPETITIONS.map((competition) => ({
    competition,
    seasons: getCompetitionSeasons(competition, now),
  }));
}

export function getActiveCsvCompetitions(): readonly (CompetitionConfig & {
  csvDivisionCode: string;
})[] {
  return ACTIVE_COMPETITIONS.filter(
    (
      competition,
    ): competition is CompetitionConfig & { csvDivisionCode: string } =>
      competition.csvDivisionCode !== undefined,
  );
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
} as const;

// Bet type IDs in the API-Football odds endpoint
export const API_FOOTBALL_BET_IDS = {
  MATCH_WINNER: 1,
  OVER_UNDER_25: 5,
  BTTS: 8,
} as const;

export const BULLMQ_QUEUES = {
  FIXTURES_SYNC: 'fixtures-sync',
  RESULTS_SYNC: 'results-sync',
  STATS_SYNC: 'stats-sync',
  ODDS_CSV_IMPORT: 'odds-csv-import',
  ODDS_LIVE_SYNC: 'odds-live-sync',
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
  RESULTS_SYNC: '0 3 * * *', // 03:00 UTC daily
  STATS_SYNC: '0 4 * * *', // 04:00 UTC daily
  ODDS_CSV_IMPORT: '0 5 * * 1', // 05:00 UTC every Monday
  ODDS_LIVE_SYNC: '0 18 * * *', // 18:00 UTC daily — pre-match snapshot for next day
} as const;

// Stable keys for upsertJobScheduler — one per queue (idempotent on restart)
export const ETL_SCHEDULER_KEYS = {
  FIXTURES_SYNC: 'cron:fixtures-sync',
  RESULTS_SYNC: 'cron:results-sync',
  STATS_SYNC: 'cron:stats-sync',
  ODDS_CSV_IMPORT: 'cron:odds-csv-import',
  ODDS_LIVE_SYNC: 'cron:odds-live-sync',
} as const;
