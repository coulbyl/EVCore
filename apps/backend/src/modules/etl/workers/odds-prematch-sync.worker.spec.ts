import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import {
  OddsPrematchSyncWorker,
  extractAdditionalMarketOdds,
  extractAllOneXTwoOdds,
  extractAsianHandicapOdds,
  extractExtendedMarketOdds,
  inspectExtendedMarkets,
  extractOneXTwoOdds,
  parseAsianHandicapValues,
  parseFixedOutcomeValues,
  parseOverUnderValues,
  FIXED_OUTCOME_MAPPINGS,
  resolveTargetDates,
} from './odds-prematch-sync.worker';
import { ApiFootballClient } from '../api-football.client';
import {
  API_FOOTBALL_BET_IDS,
  API_FOOTBALL_BOOKMAKERS,
  ODDS_INGESTION_BOOKMAKER_IDS,
  REFERENCE_ONLY_MARKETS,
  REFERENCE_BOOKMAKER,
  ODDS_CLOSING_WINDOWS,
  ETL_CRON_SCHEDULES,
} from '@config/etl.constants';
import { COHERENCE_BOOKMAKERS } from '../../betting-engine/ev.constants';
import type { FixtureService } from '../../fixture/fixture.service';
import type { ConfigService } from '@nestjs/config';
import type { NotificationService } from '../../notification/notification.service';
import type { Job } from 'bullmq';
import type { OddsPrematchSyncJobData } from './odds-prematch-sync.worker';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function buildOddsApiResponse(externalId: number, bookmakers: unknown[] = []) {
  return {
    response: [
      {
        fixture: { id: externalId },
        update: '2026-03-02T18:00:00+00:00',
        bookmakers,
      },
    ],
  };
}

function pinnacleBookmaker(home: string, draw: string, away: string) {
  return {
    id: 4,
    name: 'Pinnacle',
    bets: [
      {
        id: 1,
        name: 'Match Winner',
        values: [
          { value: 'Home', odd: home },
          { value: 'Draw', odd: draw },
          { value: 'Away', odd: away },
        ],
      },
    ],
  };
}

function pinnacleWithAdditionalMarkets() {
  return {
    id: 4,
    name: 'Pinnacle',
    bets: [
      {
        id: 1,
        name: 'Match Winner',
        values: [
          { value: 'Home', odd: 2.1 },
          { value: 'Draw', odd: 3.4 },
          { value: 'Away', odd: 4.2 },
        ],
      },
      {
        id: 5,
        name: 'Goals Over/Under',
        values: [
          { value: 'Over 2.5', odd: 1.85 },
          { value: 'Under 2.5', odd: 2 },
        ],
      },
      {
        id: 8,
        name: 'Both Teams Score',
        values: [
          { value: 'Yes', odd: 1.7 },
          { value: 'No', odd: 2.05 },
        ],
      },
      {
        id: 7,
        name: 'HT/FT Double',
        values: [
          { value: 'Home/Home', odd: 3.2 },
          { value: 'Draw/Home', odd: 5.6 },
          { value: 'Away/Away', odd: 6.1 },
        ],
      },
      {
        id: 10,
        name: 'Exact Score',
        values: [
          { value: '1:0', odd: 4.75 },
          { value: '0:0', odd: 6.25 },
          { value: 'Other', odd: 1.5 },
        ],
      },
      {
        id: 2,
        name: 'Home/Away',
        values: [
          { value: 'Home', odd: 1.22 },
          { value: 'Away', odd: 4.0 },
        ],
      },
      {
        id: 16,
        name: 'Total - Home',
        values: [
          { value: 'Over 0.5', odd: 1.11 },
          { value: 'Under 0.5', odd: 6.5 },
          { value: 'Over 1.5', odd: 1.57 },
          { value: 'Under 1.5', odd: 2.25 },
        ],
      },
      {
        id: 17,
        name: 'Total - Away',
        values: [
          { value: 'Over 0.5', odd: 1.53 },
          { value: 'Under 0.5', odd: 2.38 },
        ],
      },
      {
        id: 27,
        name: 'Clean Sheet - Home',
        values: [
          { value: 'Yes', odd: 2.38 },
          { value: 'No', odd: 1.53 },
        ],
      },
      {
        id: 28,
        name: 'Clean Sheet - Away',
        values: [
          { value: 'Yes', odd: 6.5 },
          { value: 'No', odd: 1.11 },
        ],
      },
      {
        id: 29,
        name: 'Win to Nil - Home',
        values: [
          { value: 'Yes', odd: 1.95 },
          { value: 'No', odd: 1.75 },
        ],
      },
      {
        id: 30,
        name: 'Win to Nil - Away',
        values: [
          { value: 'Yes', odd: 9.5 },
          { value: 'No', odd: 1.05 },
        ],
      },
      {
        id: 39,
        name: 'To Win Either Half',
        values: [
          { value: 'Home', odd: 1.3 },
          { value: 'Away', odd: 3.0 },
        ],
      },
      {
        id: 25,
        name: 'Result/Total Goals',
        values: [
          { value: 'Home/Over 1.5', odd: 1.83 },
          { value: 'Home/Under 1.5', odd: 7.0 },
          { value: 'Home/Over 2.5', odd: 2.2 },
          { value: 'Draw/Over 2.5', odd: 10.0 },
          { value: 'Away/Under 2.5', odd: 11.0 },
        ],
      },
      {
        id: 24,
        name: 'Results/Both Teams Score',
        values: [
          { value: 'Home/Yes', odd: 2.95 },
          { value: 'Draw/Yes', odd: 5.0 },
          { value: 'Away/Yes', odd: 8.0 },
          { value: 'Home/No', odd: 2.95 },
          { value: 'Draw/No', odd: 10.0 },
          { value: 'Away/No', odd: 9.5 },
        ],
      },
    ],
  };
}

function bet365Bookmaker(home: string, draw: string, away: string) {
  return {
    id: 8,
    name: 'Bet365',
    bets: [
      {
        id: 1,
        name: 'Match Winner',
        values: [
          { value: 'Home', odd: home },
          { value: 'Draw', odd: draw },
          { value: 'Away', odd: away },
        ],
      },
    ],
  };
}

function buildCurlStdout(body: unknown, status = 200) {
  return `${JSON.stringify(body)}\n__EVCORE_HTTP_CODE__:${status}`;
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const fixtureService = {
  findScheduledForDate: vi.fn(),
  upsertOddsSnapshot: vi.fn().mockResolvedValue({ id: 'snap-id' }),
  upsertOneXTwoOddsSnapshot: vi.fn().mockResolvedValue({ id: 'snap-1x2' }),
} satisfies Partial<FixtureService>;

const config = {
  getOrThrow: vi.fn().mockReturnValue('test-api-key'),
} satisfies Partial<ConfigService>;

const notification = {
  sendEtlFailureAlert: vi.fn().mockResolvedValue(undefined),
} satisfies Partial<NotificationService>;

// Real client over the mocked execFile — the curl-level behavior (retry on
// transient errors, HTTP marker parsing) stays covered through the worker.
const apiFootball = new ApiFootballClient(config as unknown as ConfigService);

const worker = new OddsPrematchSyncWorker(
  fixtureService as unknown as FixtureService,
  apiFootball,
  notification as unknown as NotificationService,
);

const makeJob = (data: OddsPrematchSyncJobData = {}) =>
  ({
    data,
    opts: { attempts: 3 },
    attemptsMade: 0,
  }) as Job<OddsPrematchSyncJobData>;

beforeEach(() => {
  vi.clearAllMocks();
  config.getOrThrow.mockReturnValue('test-api-key');
  fixtureService.upsertOddsSnapshot.mockResolvedValue({ id: 'snap-id' });
  fixtureService.upsertOneXTwoOddsSnapshot.mockResolvedValue({
    id: 'snap-1x2',
  });
  // Base curl behavior: transient error. Covers the end-of-job quota /status
  // call (getQuotaUsage → null, no alert) without hanging; per-test
  // mock*Once implementations are consumed before this base one.
  vi.mocked(execFile).mockImplementation(((_file, _args, cb) => {
    cb(Object.assign(new Error('Operation timed out'), { code: 28 }), '', '');
    return {} as never;
  }) as unknown as typeof execFile);
  // Skip the 6s rate-limit sleep so tests don't time out
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn) => {
    if (typeof fn === 'function') fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
});

function mockCurlStdoutOnce(stdout: string) {
  vi.mocked(execFile).mockImplementationOnce(((_file, _args, cb) => {
    cb(null, stdout, '');
    return {} as never;
  }) as unknown as typeof execFile);
}

function mockCurlErrorOnce(message: string, code?: number) {
  vi.mocked(execFile).mockImplementationOnce(((_file, _args, cb) => {
    const error = Object.assign(new Error(message), {
      code,
    });
    cb(error, '', '');
    return {} as never;
  }) as unknown as typeof execFile);
}

// ─── Worker.process ───────────────────────────────────────────────────────────

describe('OddsPrematchSyncWorker.process', () => {
  it('does nothing when no scheduled fixtures for the date', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([]);

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(execFile).not.toHaveBeenCalled();
    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('upserts a Pinnacle snapshot when Pinnacle is available', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1379250 },
    ]);

    mockCurlStdoutOnce(
      buildCurlStdout(
        buildOddsApiResponse(1379250, [
          pinnacleBookmaker('2.10', '3.40', '4.20'),
        ]),
      ),
    );

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledOnce();
    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureId: 'fixture-uuid',
        bookmaker: 'Pinnacle',
        homeOdds: 2.1,
        drawOdds: 3.4,
        awayOdds: 4.2,
        htftOdds: {},
      }),
    );
  });

  it('falls back to Bet365 when Pinnacle is absent', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1379250 },
    ]);

    mockCurlStdoutOnce(
      buildCurlStdout(
        buildOddsApiResponse(1379250, [
          bet365Bookmaker('2.00', '3.30', '4.00'),
        ]),
      ),
    );

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Bet365' }),
    );
  });

  it('prefers Pinnacle over Bet365 when both are present', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1379250 },
    ]);

    mockCurlStdoutOnce(
      buildCurlStdout(
        buildOddsApiResponse(1379250, [
          pinnacleBookmaker('2.08', '3.38', '4.15'),
          bet365Bookmaker('2.10', '3.40', '4.20'),
        ]),
      ),
    );

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ bookmaker: 'Pinnacle', homeOdds: 2.08 }),
    );
    // Non-primary priority books contribute a 1X2-only snapshot so the
    // engine can compute a multi-book median implied probability.
    expect(fixtureService.upsertOneXTwoOddsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        bookmaker: 'Bet365',
        homeOdds: 2.1,
        drawOdds: 3.4,
        awayOdds: 4.2,
      }),
    );
  });

  it('skips fixture when API returns non-ok status', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 99999 },
    ]);

    mockCurlStdoutOnce(buildCurlStdout({ errors: [] }, 429));

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('retries once immediately when a transient network error occurs, then succeeds', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1389367 },
    ]);

    mockCurlErrorOnce('Operation timed out', 28);
    mockCurlStdoutOnce(
      buildCurlStdout(
        buildOddsApiResponse(1389367, [
          pinnacleBookmaker('2.10', '3.40', '4.20'),
        ]),
      ),
    );

    await worker.process(makeJob({ date: '2026-03-03' }));

    // 2 odds calls (transient + success) + 1 end-of-job quota /status call.
    expect(execFile).toHaveBeenCalledTimes(3);
    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledOnce();
  });

  it('skips fixture after two transient network timeouts', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 1389367 },
    ]);

    mockCurlErrorOnce('Operation timed out', 28);
    mockCurlErrorOnce('Operation timed out', 28);

    await worker.process(makeJob({ date: '2026-03-03' }));

    // 2 odds attempts + 1 end-of-job quota /status call.
    expect(execFile).toHaveBeenCalledTimes(3);
    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('skips fixture when Zod validation fails', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 12345 },
    ]);

    mockCurlStdoutOnce(buildCurlStdout({ response: [{ bad: 'data' }] }));

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('skips fixture when no odds data in response', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 12345 },
    ]);

    mockCurlStdoutOnce(buildCurlStdout({ response: [] }));

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('skips fixture when neither Pinnacle nor Bet365 has Match Winner data', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'fixture-uuid', externalId: 12345 },
    ]);

    mockCurlStdoutOnce(
      buildCurlStdout(
        buildOddsApiResponse(12345, [
          { id: 7, name: 'William Hill', bets: [] },
        ]),
      ),
    );

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).not.toHaveBeenCalled();
  });

  it('processes multiple fixtures and counts synced/skipped correctly', async () => {
    fixtureService.findScheduledForDate.mockResolvedValue([
      { id: 'uuid-1', externalId: 111 },
      { id: 'uuid-2', externalId: 222 },
    ]);

    mockCurlStdoutOnce(
      buildCurlStdout(
        buildOddsApiResponse(111, [pinnacleBookmaker('1.80', '3.50', '5.00')]),
      ),
    );
    mockCurlStdoutOnce(buildCurlStdout({ errors: [] }, 503));

    await worker.process(makeJob({ date: '2026-03-03' }));

    expect(fixtureService.upsertOddsSnapshot).toHaveBeenCalledOnce();
  });
});

// ─── resolveTargetDates ───────────────────────────────────────────────────────

describe('resolveTargetDates', () => {
  it('returns the single explicit date when provided (backfill)', () => {
    const dates = resolveTargetDates({ date: '2026-03-03' });
    expect(dates).toHaveLength(1);
    expect(dates[0]?.toISOString().slice(0, 10)).toBe('2026-03-03');
  });

  it('covers tomorrow through J+3 by default (multi-snapshot horizon)', () => {
    const dates = resolveTargetDates({});
    expect(dates).toHaveLength(3);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;
    expect(dates.map((d) => (d.getTime() - today.getTime()) / dayMs)).toEqual([
      1, 2, 3,
    ]);
  });

  it('respects an explicit horizonDays and floors it at 1', () => {
    expect(resolveTargetDates({ horizonDays: 2 })).toHaveLength(2);
    expect(resolveTargetDates({ horizonDays: 0 })).toHaveLength(1);
  });
});

// ─── extractOneXTwoOdds ───────────────────────────────────────────────────────

describe('extractOneXTwoOdds', () => {
  it('returns null when bookmakers array is empty', () => {
    expect(extractOneXTwoOdds([])).toBeNull();
  });

  // Ladbrokes (10) est hors ODDS_INGESTION_BOOKMAKER_IDS. William Hill (7)
  // jouait ce rôle jusqu'au 2026-09-15 ; il fait désormais partie des books
  // collectés, d'où le changement de témoin.
  it('returns null when no ingested bookmaker is present', () => {
    const bk = {
      id: 10,
      name: 'Ladbrokes',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          values: [
            { value: 'Home', odd: 2.1 },
            { value: 'Draw', odd: 3.4 },
            { value: 'Away', odd: 4.2 },
          ],
        },
      ],
    };
    // Cast to satisfy OddsBookmaker (values.odd already a number from Zod transform)
    expect(extractOneXTwoOdds([bk as never])).toBeNull();
  });

  it('returns null when Match Winner bet is absent for priority bookmaker', () => {
    const bk = {
      id: 4,
      name: 'Pinnacle',
      bets: [
        {
          id: 5,
          name: 'Goals Over/Under',
          values: [{ value: 'Over 2.5', odd: 1.57 }],
        },
      ],
    };
    expect(extractOneXTwoOdds([bk as never])).toBeNull();
  });

  it('returns null when Home/Draw/Away values are incomplete', () => {
    const bk = {
      id: 4,
      name: 'Pinnacle',
      bets: [
        {
          id: 1,
          name: 'Match Winner',
          // Missing Draw and Away
          values: [{ value: 'Home', odd: 2.1 }],
        },
      ],
    };
    expect(extractOneXTwoOdds([bk as never])).toBeNull();
  });
});

describe('extractAdditionalMarketOdds', () => {
  it('extracts OU/BTTS and HT/FT odds for selected bookmaker', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.overUnderOdds).toMatchObject({
      OVER: 1.85,
      UNDER: 2,
    });
    expect(additional.bttsYesOdds).toBe(1.7);
    expect(additional.bttsNoOdds).toBe(2.05);
    expect(additional.htftOdds).toEqual({
      HOME_HOME: 3.2,
      DRAW_HOME: 5.6,
      AWAY_AWAY: 6.1,
    });
  });

  it('extracts exact-score odds and skips non "H:A" buckets', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    // "Other"/catch-all values are dropped; only "H:A" scorelines are kept.
    expect(additional.correctScoreOdds).toEqual({ '1:0': 4.75, '0:0': 6.25 });
  });

  it('extracts Draw No Bet odds from the "Home/Away" bet (id 2)', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.drawNoBetOdds).toEqual({ home: 1.22, away: 4.0 });
  });

  it('extracts sparse Team Total odds per side', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.teamTotalHomeOdds).toEqual({
      OVER_0_5: 1.11,
      UNDER_0_5: 6.5,
      OVER_1_5: 1.57,
      UNDER_1_5: 2.25,
    });
    expect(additional.teamTotalAwayOdds).toEqual({
      OVER_0_5: 1.53,
      UNDER_0_5: 2.38,
    });
  });

  it('returns null/empty DNB and Team Total when the bookmaker is absent', () => {
    const additional = extractAdditionalMarketOdds([], 'Pinnacle');

    expect(additional.drawNoBetOdds).toBeNull();
    expect(additional.teamTotalHomeOdds).toEqual({});
    expect(additional.teamTotalAwayOdds).toEqual({});
  });

  it('extracts Clean Sheet Home/Away odds (Yes/No)', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.cleanSheetHomeOdds).toEqual({ yes: 2.38, no: 1.53 });
    expect(additional.cleanSheetAwayOdds).toEqual({ yes: 6.5, no: 1.11 });
  });

  it('extracts Win to Nil Home/Away odds (Yes/No)', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.winToNilHomeOdds).toEqual({ yes: 1.95, no: 1.75 });
    expect(additional.winToNilAwayOdds).toEqual({ yes: 9.5, no: 1.05 });
  });

  it('extracts To Win Either Half odds (Home/Away, no third value)', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.winEitherHalfOdds).toEqual({ home: 1.3, away: 3.0 });
  });

  it('returns null for Clean Sheet/Win to Nil/To Win Either Half when the bookmaker is absent', () => {
    const additional = extractAdditionalMarketOdds([], 'Pinnacle');

    expect(additional.cleanSheetHomeOdds).toBeNull();
    expect(additional.cleanSheetAwayOdds).toBeNull();
    expect(additional.winToNilHomeOdds).toBeNull();
    expect(additional.winToNilAwayOdds).toBeNull();
    expect(additional.winEitherHalfOdds).toBeNull();
  });

  it('extracts Result/Total Goals odds — sparse, keyed by side+line', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.resultTotalGoalsOdds).toEqual({
      HOME_OVER_1_5: 1.83,
      HOME_UNDER_1_5: 7.0,
      HOME_OVER_2_5: 2.2,
      DRAW_OVER_2_5: 10.0,
      AWAY_UNDER_2_5: 11.0,
    });
  });

  it('extracts Results/Both Teams Score odds — fixed 6-cell grid', () => {
    const bk = pinnacleWithAdditionalMarkets();
    const additional = extractAdditionalMarketOdds([bk as never], 'Pinnacle');

    expect(additional.resultBttsOdds).toEqual({
      HOME_YES: 2.95,
      DRAW_YES: 5.0,
      AWAY_YES: 8.0,
      HOME_NO: 2.95,
      DRAW_NO: 10.0,
      AWAY_NO: 9.5,
    });
  });

  it('returns empty maps for Result/Total Goals and Result/BTTS when the bookmaker is absent', () => {
    const additional = extractAdditionalMarketOdds([], 'Pinnacle');

    expect(additional.resultTotalGoalsOdds).toEqual({});
    expect(additional.resultBttsOdds).toEqual({});
  });
});

describe('API_FOOTBALL_BET_IDS regression (Double Chance / DNB id fix)', () => {
  it('DOUBLE_CHANCE points at the real Double Chance bet (id 12), not DNB', () => {
    expect(API_FOOTBALL_BET_IDS.DOUBLE_CHANCE).toBe(12);
    expect(API_FOOTBALL_BET_IDS.DRAW_NO_BET).toBe(2);
    expect(API_FOOTBALL_BET_IDS.TEAM_TOTAL_HOME).toBe(16);
    expect(API_FOOTBALL_BET_IDS.TEAM_TOTAL_AWAY).toBe(17);
  });

  it('Niveau 2 bet ids match the live API-Football reference (2026-07-18)', () => {
    expect(API_FOOTBALL_BET_IDS.CLEAN_SHEET_HOME).toBe(27);
    expect(API_FOOTBALL_BET_IDS.CLEAN_SHEET_AWAY).toBe(28);
    expect(API_FOOTBALL_BET_IDS.WIN_TO_NIL_HOME).toBe(29);
    expect(API_FOOTBALL_BET_IDS.WIN_TO_NIL_AWAY).toBe(30);
    expect(API_FOOTBALL_BET_IDS.TO_WIN_EITHER_HALF).toBe(39);
  });

  it('Niveau 2.b bet ids match the live API-Football reference (2026-07-18)', () => {
    expect(API_FOOTBALL_BET_IDS.RESULT_TOTAL_GOALS).toBe(25);
    expect(API_FOOTBALL_BET_IDS.RESULT_BTTS).toBe(24);
  });
});

// Chantier A du plan de rentabilité (2026-09-15) : l'ingestion passe de 5 à
// 11 books. Ces tests verrouillent les deux propriétés qui rendent
// l'élargissement sans danger — Pinnacle reste le book primaire, et le
// garde-fou de cohérence reste calculé sur son périmètre d'origine.
describe('élargissement du vivier de books (2026-09-15)', () => {
  it('collecte les onze books, Pinnacle en tête', () => {
    expect(ODDS_INGESTION_BOOKMAKER_IDS[0]).toBe(
      API_FOOTBALL_BOOKMAKERS.PINNACLE,
    );
    expect(ODDS_INGESTION_BOOKMAKER_IDS).toHaveLength(11);
    for (const id of [
      API_FOOTBALL_BOOKMAKERS.ONE_X_BET,
      API_FOOTBALL_BOOKMAKERS.BETANO,
      API_FOOTBALL_BOOKMAKERS.WILLIAM_HILL,
      API_FOOTBALL_BOOKMAKERS.BETFAIR,
      API_FOOTBALL_BOOKMAKERS.BETVICTOR,
      API_FOOTBALL_BOOKMAKERS.SBO,
    ]) {
      expect(ODDS_INGESTION_BOOKMAKER_IDS).toContain(id);
    }
  });

  it('les ids des books ajoutés correspondent au catalogue API-Football', () => {
    expect(API_FOOTBALL_BOOKMAKERS.ONE_X_BET).toBe(11);
    expect(API_FOOTBALL_BOOKMAKERS.BETANO).toBe(32);
    expect(API_FOOTBALL_BOOKMAKERS.WILLIAM_HILL).toBe(7);
    expect(API_FOOTBALL_BOOKMAKERS.BETFAIR).toBe(3);
    expect(API_FOOTBALL_BOOKMAKERS.BETVICTOR).toBe(36);
    expect(API_FOOTBALL_BOOKMAKERS.SBO).toBe(5);
  });

  it("le garde-fou de cohérence n'hérite pas des books ajoutés", () => {
    expect([...COHERENCE_BOOKMAKERS]).toEqual([
      'Pinnacle',
      'Bet365',
      'Unibet',
      'Marathonbet',
      'Bwin',
    ]);
    expect(COHERENCE_BOOKMAKERS).not.toContain('1xBet');
    expect(COHERENCE_BOOKMAKERS).not.toContain('Betano');
    expect(COHERENCE_BOOKMAKERS.length).toBeLessThan(
      ODDS_INGESTION_BOOKMAKER_IDS.length,
    );
  });

  it('extrait le 1X2 des books ajoutés, Pinnacle toujours en premier', () => {
    // `odd` est déjà numérique ici : le schéma Zod le convertit à l'ingestion.
    const oneXTwo = (home: number, draw: number, away: number) => ({
      id: API_FOOTBALL_BET_IDS.MATCH_WINNER,
      name: 'Match Winner',
      values: [
        { value: 'Home', odd: home },
        { value: 'Draw', odd: draw },
        { value: 'Away', odd: away },
      ],
    });
    const result = extractAllOneXTwoOdds([
      {
        id: API_FOOTBALL_BOOKMAKERS.BETANO,
        name: 'Betano',
        bets: [oneXTwo(1.9, 3.4, 4.1)],
      },
      {
        id: API_FOOTBALL_BOOKMAKERS.PINNACLE,
        name: 'Pinnacle',
        bets: [oneXTwo(1.95, 3.5, 4.0)],
      },
      {
        id: API_FOOTBALL_BOOKMAKERS.ONE_X_BET,
        name: '1xBet',
        bets: [oneXTwo(1.98, 3.55, 4.2)],
      },
    ]);
    expect(result.map((row) => row.bookmaker)).toEqual([
      'Pinnacle',
      '1xBet',
      'Betano',
    ]);
  });
});

// Handicap asiatique (chantier A, tâches A-8/A-9). Le format de l'API a été
// relevé sur données réelles le 2026-09-15 : « Home -0.25 », « Away +0 ».
describe('handicap asiatique', () => {
  const bet = (values: Array<{ value: string; odd: number }>) => ({
    id: API_FOOTBALL_BET_IDS.ASIAN_HANDICAP,
    name: 'Asian Handicap',
    values,
  });

  it('parse le côté, la ligne signée et la cote', () => {
    expect(
      parseAsianHandicapValues(
        bet([
          { value: 'Home -0.25', odd: 4.04 },
          { value: 'Away -0.25', odd: 1.25 },
          { value: 'Home +0', odd: 5.23 },
          { value: 'Away +0.5', odd: 1.43 },
        ]),
      ),
    ).toEqual([
      { pick: 'HOME', line: -0.25, odds: 4.04 },
      { pick: 'AWAY', line: -0.25, odds: 1.25 },
      { pick: 'HOME', line: 0, odds: 5.23 },
      { pick: 'AWAY', line: 0.5, odds: 1.43 },
    ]);
  });

  it('conserve les lignes en quart de but sans les arrondir', () => {
    const legs = parseAsianHandicapValues(
      bet([
        { value: 'Home -0.75', odd: 7.0 },
        { value: 'Home +1.25', odd: 1.55 },
      ]),
    );
    expect(legs.map((leg) => leg.line)).toEqual([-0.75, 1.25]);
  });

  // Les deux côtés d'un même handicap portent le même signe : c'est ce qui
  // rend la ligne discriminante et impose la colonne `line` dans la contrainte
  // d'unicité. Apparier Home -L avec Away +L donnerait des marges négatives.
  it('garde les deux côtés d’une même ligne comme deux jambes distinctes', () => {
    const legs = parseAsianHandicapValues(
      bet([
        { value: 'Home -0.5', odd: 6.6 },
        { value: 'Away -0.5', odd: 1.11 },
      ]),
    );
    expect(legs).toHaveLength(2);
    expect(new Set(legs.map((leg) => leg.line))).toEqual(new Set([-0.5]));
    expect(legs.map((leg) => leg.pick)).toEqual(['HOME', 'AWAY']);
  });

  it('ignore les valeurs illisibles et les cotes non jouables', () => {
    expect(
      parseAsianHandicapValues(
        bet([
          { value: 'Draw', odd: 3.2 },
          { value: 'Home', odd: 2.1 },
          { value: 'Home -0.5', odd: 1 },
          { value: 'Away -0.5', odd: 1.9 },
        ]),
      ),
    ).toEqual([{ pick: 'AWAY', line: -0.5, odds: 1.9 }]);
  });

  it('renvoie des listes vides quand le book ne price pas le marché', () => {
    expect(parseAsianHandicapValues(undefined)).toEqual([]);
    expect(extractAsianHandicapOdds([], 'Pinnacle')).toEqual({
      fullTime: [],
      firstHalf: [],
    });
  });

  it('sépare le plein match de la mi-temps', () => {
    const result = extractAsianHandicapOdds(
      [
        {
          id: API_FOOTBALL_BOOKMAKERS.PINNACLE,
          name: 'Pinnacle',
          bets: [
            bet([{ value: 'Home -0.25', odd: 4.04 }]),
            {
              id: API_FOOTBALL_BET_IDS.ASIAN_HANDICAP_HT,
              name: 'Asian Handicap First Half',
              values: [{ value: 'Home +0.5', odd: 1.9 }],
            },
          ],
        },
      ],
      'Pinnacle',
    );
    expect(result.fullTime).toEqual([
      { pick: 'HOME', line: -0.25, odds: 4.04 },
    ]);
    expect(result.firstHalf).toEqual([{ pick: 'HOME', line: 0.5, odds: 1.9 }]);
  });

  it('les ids de pari correspondent au catalogue API-Football', () => {
    expect(API_FOOTBALL_BET_IDS.ASIAN_HANDICAP).toBe(4);
    expect(API_FOOTBALL_BET_IDS.ASIAN_HANDICAP_HT).toBe(19);
  });
});

// Marchés ajoutés le 2026-09-15 (chantier A, A-10 à A-15). Formats relevés sur
// l'API le même jour.
describe('marchés à ligne et à issues fixes', () => {
  it('distingue une absence fournisseur d’un libellé rejeté par le parseur', () => {
    const diagnostics = inspectExtendedMarkets(
      [
        {
          id: API_FOOTBALL_BOOKMAKERS.PINNACLE,
          name: 'Pinnacle',
          bets: [
            {
              id: API_FOOTBALL_BET_IDS.OVER_UNDER_2H,
              name: 'Second Half Goals',
              values: [
                { value: 'Over 1.5', odd: 1.8 },
                { value: 'Moins de 1.5', odd: 2 },
              ],
            },
          ],
        },
      ],
      'Pinnacle',
    );

    expect(
      diagnostics.find((entry) => entry.market === 'OVER_UNDER_2H'),
    ).toEqual({
      market: 'OVER_UNDER_2H',
      rawValues: 2,
      parsedValues: 1,
      rejectedLabels: ['Moins de 1.5'],
    });
    expect(diagnostics.find((entry) => entry.market === 'CORNERS')).toEqual({
      market: 'CORNERS',
      rawValues: 0,
      parsedValues: 0,
      rejectedLabels: [],
    });
  });

  it('parse une ligne décimale comme une ligne entière', () => {
    // Les corners cotent « Over 9 » autant que « Over 8.5 » : c'est ce que
    // l'encodage historique de la ligne dans `pick` ne savait pas représenter.
    expect(
      parseOverUnderValues({
        id: API_FOOTBALL_BET_IDS.CORNERS,
        name: 'Corners Over Under',
        values: [
          { value: 'Over 8.5', odd: 1.73 },
          { value: 'Under 8.5', odd: 2.0 },
          { value: 'Over 9', odd: 1.98 },
          { value: 'Under 9', odd: 1.82 },
        ],
      }),
    ).toEqual([
      { pick: 'OVER', line: 8.5, odds: 1.73 },
      { pick: 'UNDER', line: 8.5, odds: 2.0 },
      { pick: 'OVER', line: 9, odds: 1.98 },
      { pick: 'UNDER', line: 9, odds: 1.82 },
    ]);
  });

  it('ignore les valeurs illisibles et les cotes non jouables', () => {
    expect(
      parseOverUnderValues({
        id: API_FOOTBALL_BET_IDS.CARDS,
        name: 'Cards Over/Under',
        values: [
          { value: 'Yes', odd: 1.9 },
          { value: 'Over 2.5', odd: 1 },
          { value: 'Under 2.5', odd: 4.25 },
        ],
      }),
    ).toEqual([{ pick: 'UNDER', line: 2.5, odds: 4.25 }]);
  });

  it('traduit les libellés des marchés à issues fixes', () => {
    expect(
      parseFixedOutcomeValues(
        {
          id: API_FOOTBALL_BET_IDS.HIGHEST_SCORING_HALF,
          name: 'Highest Scoring Half',
          values: [
            { value: 'Draw', odd: 3.5 },
            { value: '1st Half', odd: 2.8 },
            { value: '2nd Half', odd: 2.1 },
          ],
        },
        FIXED_OUTCOME_MAPPINGS.HIGHEST_SCORING_HALF,
      ),
    ).toEqual([
      { pick: 'DRAW', odds: 3.5 },
      { pick: 'FIRST_HALF', odds: 2.8 },
      { pick: 'SECOND_HALF', odds: 2.1 },
    ]);
  });

  it("n'enregistre jamais une issue inconnue telle quelle", () => {
    expect(
      parseFixedOutcomeValues(
        {
          id: API_FOOTBALL_BET_IDS.TEAM_TO_SCORE_FIRST,
          name: 'Team To Score First',
          values: [
            { value: 'No goal', odd: 12 },
            { value: 'Neither', odd: 9 },
          ],
        },
        FIXED_OUTCOME_MAPPINGS.TEAM_TO_SCORE_FIRST,
      ),
    ).toEqual([{ pick: 'NO_GOAL', odds: 12 }]);
  });

  it('regroupe les marchés servis par un book et omet les absents', () => {
    const result = extractExtendedMarketOdds(
      [
        {
          id: API_FOOTBALL_BOOKMAKERS.BET365,
          name: 'Bet365',
          bets: [
            {
              id: API_FOOTBALL_BET_IDS.CORNERS,
              name: 'Corners Over Under',
              values: [{ value: 'Over 9', odd: 1.98 }],
            },
            {
              id: API_FOOTBALL_BET_IDS.ODD_EVEN,
              name: 'Odd/Even',
              values: [{ value: 'Odd', odd: 1.85 }],
            },
          ],
        },
      ],
      'Bet365',
    );
    expect(result.lineMarkets).toEqual([
      { market: 'CORNERS', legs: [{ pick: 'OVER', line: 9, odds: 1.98 }] },
    ]);
    expect(result.fixedMarkets).toEqual([
      { market: 'ODD_EVEN', legs: [{ pick: 'ODD', odds: 1.85 }] },
    ]);
  });

  it('renvoie des listes vides pour un book absent', () => {
    expect(extractExtendedMarketOdds([], 'Pinnacle')).toEqual({
      lineMarkets: [],
      fixedMarkets: [],
    });
  });

  it('les ids de pari correspondent au catalogue API-Football', () => {
    expect(API_FOOTBALL_BET_IDS.OVER_UNDER_2H).toBe(26);
    expect(API_FOOTBALL_BET_IDS.CORNERS).toBe(45);
    expect(API_FOOTBALL_BET_IDS.CORNERS_HT).toBe(77);
    expect(API_FOOTBALL_BET_IDS.CARDS).toBe(80);
    expect(API_FOOTBALL_BET_IDS.ODD_EVEN).toBe(21);
    expect(API_FOOTBALL_BET_IDS.ODD_EVEN_HT).toBe(22);
    expect(API_FOOTBALL_BET_IDS.HIGHEST_SCORING_HALF).toBe(11);
    expect(API_FOOTBALL_BET_IDS.TEAM_TO_SCORE_FIRST).toBe(14);
  });
});

// Politique de collecte décidée le 2026-09-15 après mesure des marges : on
// collecte large là où on pourrait parier, un seul book de référence là où on
// ne fait qu'étudier. Sans ça, 44 % des 424 lignes par match partiraient dans
// des marchés que la mesure a écartés.
describe('politique de collecte par marché', () => {
  it('ne réserve au book de référence que les marchés trop chers', () => {
    expect([...REFERENCE_ONLY_MARKETS]).toEqual([
      'OVER_UNDER_2H',
      'CORNERS',
      'CORNERS_HT',
      'CARDS',
      'ODD_EVEN',
      'ODD_EVEN_HT',
      'HIGHEST_SCORING_HALF',
      'TEAM_TO_SCORE_FIRST',
    ]);
  });

  it('laisse le handicap asiatique collecté chez tous les books', () => {
    // C'est la cible : 4,26 % de marge, la plus basse du carnet. Le courtage
    // multi-books n'a de sens que sur les marchés qu'on joue.
    expect(REFERENCE_ONLY_MARKETS).not.toContain('ASIAN_HANDICAP');
    expect(REFERENCE_ONLY_MARKETS).not.toContain('ASIAN_HANDICAP_HT');
  });

  it('le book de référence fait partie du vivier collecté', () => {
    expect(REFERENCE_BOOKMAKER).toBe('Pinnacle');
    expect(ODDS_INGESTION_BOOKMAKER_IDS[0]).toBe(
      API_FOOTBALL_BOOKMAKERS.PINNACLE,
    );
  });
});

// Balayage de clôture (chantier B, tâches B-1 et B-2). Sans lui le dernier
// relevé tombe en médiane 7,5 h avant le coup d'envoi, donc aucune ligne de
// clôture, donc pas de CLV.
describe('fenêtres de capture avant coup d’envoi', () => {
  it('capture une heure avant, puis juste avant le coup d’envoi', () => {
    expect(ODDS_CLOSING_WINDOWS.map((window) => window.name)).toEqual([
      'T-60',
      'T-10',
    ]);
  });

  it('laisse les fenêtres plus larges que le pas du cron', () => {
    // Le cron passe toutes les 10 minutes : une fenêtre plus étroite raterait
    // des rencontres au moindre retard de file.
    const stepMinutes = 10;
    for (const window of ODDS_CLOSING_WINDOWS) {
      expect(window.toMinutes - window.fromMinutes).toBeGreaterThanOrEqual(
        stepMinutes,
      );
      expect(window.fromMinutes).toBeGreaterThan(0);
      expect(window.toMinutes).toBeGreaterThan(window.fromMinutes);
    }
  });

  it('ne laisse pas les deux fenêtres se chevaucher', () => {
    const [first, second] = ODDS_CLOSING_WINDOWS;
    expect(second.toMinutes).toBeLessThan(first.fromMinutes);
  });

  it('planifie le balayage plus souvent que la synchro d’horizon', () => {
    expect(ETL_CRON_SCHEDULES.ODDS_CLOSING_SYNC).toBe('*/10 * * * *');
    expect(ETL_CRON_SCHEDULES.ODDS_PREMATCH_SYNC).toBe('0 6,18 * * *');
  });
});
