import { ETL_CONSTANTS } from '@config/etl.constants';
import { createLogger } from '@utils/logger';
import { parseIsoDate } from '@utils/date.utils';
import { ApiFootballClient } from './api-football.client';
import { ApiFootballLeaguesResponseSchema } from './schemas/leagues.schema';

// Authoritative season date range from API-FOOTBALL's own /leagues data —
// used instead of guessing dates from `seasonStartMonth` (see
// leagues.schema.ts for why the heuristic breaks on format transitions and
// off-season gaps). Best-effort: any failure (network, non-2xx, Zod, no
// matching `year` in the response) returns null and the caller falls back
// to the local heuristic — this must never block a fixtures sync.
export type LeagueSeasonDates = { startDate: Date; endDate: Date };

const logger = createLogger('league-season-dates');

export async function fetchLeagueSeasonDates(
  apiFootball: ApiFootballClient,
  leagueId: string,
  season: number,
): Promise<LeagueSeasonDates | null> {
  const url = `${ETL_CONSTANTS.API_FOOTBALL_BASE}/leagues?id=${leagueId}`;

  try {
    const result = await apiFootball.fetchJson(url);
    const res = result.response;
    if (res === null || res.status < 200 || res.status >= 300) {
      logger.warn(
        { leagueId, season, status: res?.status ?? null },
        'Leagues fetch failed — falling back to local season-date heuristic',
      );
      return null;
    }

    const parsed = ApiFootballLeaguesResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      logger.warn(
        { leagueId, season, issues: parsed.error.issues },
        'Leagues Zod validation failed — falling back to local season-date heuristic',
      );
      return null;
    }

    const entry = parsed.data.response[0];
    const seasonEntry = entry?.seasons.find((s) => s.year === season);
    if (!seasonEntry) {
      logger.warn(
        { leagueId, season },
        'No matching season year in leagues response — falling back to local season-date heuristic',
      );
      return null;
    }

    return {
      startDate: parseIsoDate(`${seasonEntry.start}T00:00:00Z`),
      endDate: parseIsoDate(`${seasonEntry.end}T00:00:00Z`),
    };
  } catch (error) {
    logger.warn(
      {
        leagueId,
        season,
        error: error instanceof Error ? error.message : String(error),
      },
      'Leagues fetch threw — falling back to local season-date heuristic',
    );
    return null;
  }
}
