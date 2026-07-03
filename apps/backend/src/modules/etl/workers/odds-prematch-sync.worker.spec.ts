import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import {
  OddsPrematchSyncWorker,
  extractAdditionalMarketOdds,
  extractOneXTwoOdds,
  resolveTargetDates,
} from './odds-prematch-sync.worker';
import { ApiFootballClient } from '../api-football.client';
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
});
