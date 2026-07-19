import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import {
  OddsPrematchSyncWorker,
  extractAdditionalMarketOdds,
  extractOneXTwoOdds,
  resolveTargetDates,
} from './odds-prematch-sync.worker';
import { ApiFootballClient } from '../api-football.client';
import { API_FOOTBALL_BET_IDS } from '@config/etl.constants';
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

  it('returns null when no Pinnacle or Bet365 bookmaker', () => {
    const bk = {
      id: 7,
      name: 'William Hill',
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
