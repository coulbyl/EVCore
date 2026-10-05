import type { ConfigService } from '@nestjs/config';
import { STATS_BACKFILL } from '@config/etl.constants';
import type { StatsBackfillCandidateRow } from '../fixture/fixture.repository';
import type { ApiFootballQuotaUsage } from './api-football.client';

// Pure planning rules of the automatic stats backfill — no I/O, so the
// ordering and budget decisions are unit-tested without a queue or database.

export type RankedStatsBackfillSeason = StatsBackfillCandidateRow & {
  wave: number;
  // 0 = the competition's most recent season, 1 = N-1, …
  seasonRank: number;
  // Season not over yet: its rolling stats feed upcoming predictions.
  inProgress: boolean;
  // API-Football does not cover its statistics — draining it is waste.
  parked: boolean;
};

const WAVE_COUNT = STATS_BACKFILL.WAVES.length + 1;

export function statsBackfillWave(competitionCode: string): {
  wave: number;
  position: number;
} {
  for (const [index, codes] of STATS_BACKFILL.WAVES.entries()) {
    const position = (codes as readonly string[]).indexOf(competitionCode);
    if (position !== -1) return { wave: index + 1, position };
  }
  return { wave: WAVE_COUNT, position: Number.MAX_SAFE_INTEGER };
}

export function isStatsBackfillParked(counts: {
  synced: number;
  unavailable: number;
}): boolean {
  const attempted = counts.synced + counts.unavailable;
  if (attempted < STATS_BACKFILL.PROBE_LOT_SIZE) return false;
  return counts.synced / attempted < STATS_BACKFILL.MIN_COVERAGE_RATIO;
}

// Runbook order: inside a wave, every competition's current season first,
// then every N-1, then N-2… — the next predictions improve before the
// calibration history grows.
export function rankStatsBackfillSeasons(
  candidates: StatsBackfillCandidateRow[],
  now: Date,
): RankedStatsBackfillSeason[] {
  const byCompetition = new Map<string, StatsBackfillCandidateRow[]>();
  for (const candidate of candidates) {
    const seasons = byCompetition.get(candidate.competitionCode) ?? [];
    seasons.push(candidate);
    byCompetition.set(candidate.competitionCode, seasons);
  }

  const ranked = [...byCompetition.values()].flatMap((seasons) =>
    [...seasons]
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map((season, seasonRank) => ({
        ...season,
        wave: statsBackfillWave(season.competitionCode).wave,
        seasonRank,
        inProgress: season.endDate.getTime() >= now.getTime(),
        parked: isStatsBackfillParked(season),
      })),
  );

  // Seasons still in progress come first, across every wave: their rolling
  // stats feed the next predictions, while a finished N-1 of wave 1 only
  // feeds calibration and backtests. Before this, an N-2 of the Premier
  // League ranked ahead of the current MLS season, and the routine sync
  // (10 fixtures per competition per day) left current-season fixtures
  // without xG for a week in the calendar leagues (measured 2026-10-05:
  // 165 of the last 356 played fixtures still without statistics, p90 8 days).
  return ranked.sort(
    (a, b) =>
      Number(b.inProgress) - Number(a.inProgress) ||
      a.wave - b.wave ||
      a.seasonRank - b.seasonRank ||
      statsBackfillWave(a.competitionCode).position -
        statsBackfillWave(b.competitionCode).position ||
      a.competitionCode.localeCompare(b.competitionCode),
  );
}

export function statsBackfillDailyReserve(
  config: Pick<ConfigService, 'get'>,
): number {
  const value = config.get<string>('STATS_BACKFILL_DAILY_RESERVE')?.trim();
  const raw = value ? Number(value) : Number.NaN;
  return Number.isFinite(raw) && raw >= 0
    ? raw
    : STATS_BACKFILL.DEFAULT_DAILY_RESERVE;
}

// Calls the backfill may still spend today without eating into the reserve
// left to production crons. Quota resets at 00:00 UTC.
export function statsBackfillBudget(
  usage: ApiFootballQuotaUsage,
  reserve: number,
): number {
  return Math.max(0, usage.limitDay - usage.current - reserve);
}

export function statsBackfillLotSize(
  season: Pick<StatsBackfillCandidateRow, 'synced' | 'unavailable'>,
  budget: number,
): number {
  // The probe is a ceiling on total attempts, not per lot: a probe cut short
  // (quota, restart) resumes with only what is left of it.
  const attempted = season.synced + season.unavailable;
  const cap =
    attempted < STATS_BACKFILL.PROBE_LOT_SIZE
      ? STATS_BACKFILL.PROBE_LOT_SIZE - attempted
      : STATS_BACKFILL.MAX_FIXTURES_PER_LOT;
  return Math.max(0, Math.min(cap, budget));
}
