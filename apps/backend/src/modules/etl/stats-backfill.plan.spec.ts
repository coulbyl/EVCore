import { describe, it, expect } from 'vitest';
import type { StatsBackfillCandidateRow } from '../fixture/fixture.repository';
import {
  isStatsBackfillParked,
  rankStatsBackfillSeasons,
  statsBackfillBudget,
  statsBackfillDailyReserve,
  statsBackfillLotSize,
  statsBackfillWave,
} from './stats-backfill.plan';

const NOW = new Date('2026-09-28T12:00:00Z');

function season(
  competitionCode: string,
  startYear: number,
  counts: Partial<
    Pick<StatsBackfillCandidateRow, 'synced' | 'unavailable' | 'pending'>
  > = {},
): StatsBackfillCandidateRow {
  return {
    seasonId: `${competitionCode}-${startYear}`,
    seasonName: `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
    competitionCode,
    startDate: new Date(Date.UTC(startYear, 7, 1)),
    endDate: new Date(Date.UTC(startYear + 1, 5, 30)),
    synced: 0,
    unavailable: 0,
    pending: 100,
    ...counts,
  };
}

describe('statsBackfillWave', () => {
  it('places runbook waves in order and everything else in wave 4', () => {
    expect(statsBackfillWave('PL')).toEqual({ wave: 1, position: 0 });
    expect(statsBackfillWave('L1').wave).toBe(1);
    expect(statsBackfillWave('CH').wave).toBe(2);
    expect(statsBackfillWave('UCL').wave).toBe(3);
    expect(statsBackfillWave('J1').wave).toBe(4);
  });
});

describe('rankStatsBackfillSeasons', () => {
  it('finishes every current season of every wave before any N-1', () => {
    // A current season feeds the next predictions, a finished one only the
    // calibration: CH (wave 2) in progress outranks PL/LL 2025 (wave 1, done).
    const ranked = rankStatsBackfillSeasons(
      [
        season('LL', 2025),
        season('PL', 2025),
        season('LL', 2026),
        season('PL', 2026),
        season('CH', 2026),
      ],
      NOW,
    );

    expect(ranked.map((s) => s.seasonId)).toEqual([
      'PL-2026',
      'LL-2026',
      'CH-2026',
      'PL-2025',
      'LL-2025',
    ]);
    expect(ranked[0]).toMatchObject({ seasonRank: 0, inProgress: true });
    expect(ranked[3]).toMatchObject({ seasonRank: 1, inProgress: false });
  });

  it('ranks seasons by start date, not by name', () => {
    // Legacy calendar season stored as "2025-26" while the new one is "2026".
    const legacy = { ...season('J1', 2025), seasonName: '2025-26' };
    const current = { ...season('J1', 2026), seasonName: '2026' };
    const ranked = rankStatsBackfillSeasons([legacy, current], NOW);
    expect(ranked.map((s) => s.seasonName)).toEqual(['2026', '2025-26']);
  });

  it('flags seasons API-Football does not cover', () => {
    const [ranked] = rankStatsBackfillSeasons(
      [season('SVN1', 2023, { synced: 1, unavailable: 30 })],
      NOW,
    );
    expect(ranked?.parked).toBe(true);
  });
});

describe('isStatsBackfillParked', () => {
  it('never parks before a full probe', () => {
    expect(isStatsBackfillParked({ synced: 0, unavailable: 19 })).toBe(false);
  });

  it('parks under 20% coverage once probed', () => {
    expect(isStatsBackfillParked({ synced: 3, unavailable: 17 })).toBe(true);
    expect(isStatsBackfillParked({ synced: 4, unavailable: 16 })).toBe(false);
  });
});

describe('statsBackfillBudget', () => {
  it('keeps the reserve for production crons', () => {
    expect(
      statsBackfillBudget({ current: 1_000, limitDay: 7_500 }, 2_500),
    ).toBe(4_000);
    expect(
      statsBackfillBudget({ current: 5_200, limitDay: 7_500 }, 2_500),
    ).toBe(0);
  });
});

describe('statsBackfillLotSize', () => {
  it('probes an untried season with a small lot', () => {
    expect(statsBackfillLotSize({ synced: 0, unavailable: 0 }, 4_000)).toBe(20);
  });

  it('resumes an interrupted probe with only what is left of it', () => {
    expect(statsBackfillLotSize({ synced: 6, unavailable: 4 }, 4_000)).toBe(10);
  });

  it('uses a full lot once the season is probed', () => {
    expect(statsBackfillLotSize({ synced: 50, unavailable: 0 }, 4_000)).toBe(
      100,
    );
  });

  it('never exceeds the remaining budget', () => {
    expect(statsBackfillLotSize({ synced: 50, unavailable: 0 }, 37)).toBe(37);
  });
});

describe('statsBackfillDailyReserve', () => {
  it('defaults to 2 500 and reads the override', () => {
    expect(statsBackfillDailyReserve({ get: () => undefined })).toBe(2_500);
    expect(statsBackfillDailyReserve({ get: () => '' })).toBe(2_500);
    expect(statsBackfillDailyReserve({ get: () => '3000' })).toBe(3_000);
    expect(statsBackfillDailyReserve({ get: () => 'oops' })).toBe(2_500);
  });
});
