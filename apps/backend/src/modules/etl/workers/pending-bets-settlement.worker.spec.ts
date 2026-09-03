import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import type { Job } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import { ApiFootballClient } from '../api-football.client';
import type { FixtureService } from '../../fixture/fixture.service';
import type { BettingEngineService } from '../../betting-engine/betting-engine.service';
import type { NotificationService } from '../../notification/notification.service';
import type { AdjustmentService } from '../../adjustment/adjustment.service';
import type { CouponSettlementService } from '../../coupon/coupon-settlement.service';
import type { CacheService } from '@common/redis/cache.service';
import { PendingBetsSettlementWorker } from './pending-bets-settlement.worker';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Per-status fixture values. AET: 2-2 at 90 minutes (fulltime), 3-2 after
// extra time (goals) — the exact Belgium-Senegal scenario reported.
// Settlement must use fulltime, not the post-extra-time `goals` total.
const FIXTURE_VALUES_BY_STATUS = {
  NS: {
    finished: false,
    elapsed: null as number | null,
    homeWinner: false,
    goals: { home: null as number | null, away: null as number | null },
    halftime: { home: null as number | null, away: null as number | null },
    fulltime: { home: null as number | null, away: null as number | null },
    extratime: { home: null as number | null, away: null as number | null },
  },
  FT: {
    finished: true,
    elapsed: 90,
    homeWinner: true,
    goals: { home: 2, away: 1 },
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 1 },
    extratime: { home: null as number | null, away: null as number | null },
  },
  AET: {
    finished: true,
    elapsed: 120,
    homeWinner: true,
    goals: { home: 3, away: 2 },
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 2 },
    extratime: { home: 1, away: 0 },
  },
};

function buildFixtureResponse(status: 'NS' | 'FT' | 'AET') {
  const v = FIXTURE_VALUES_BY_STATUS[status];
  return {
    get: 'fixtures',
    parameters: { id: '999' },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 999,
          referee: null,
          timezone: 'UTC',
          date: '2025-03-15T20:00:00+00:00',
          timestamp: 1742068800,
          periods: { first: 1742068800, second: 1742072400 },
          venue: { id: 1, name: 'Stadium', city: 'City' },
          status: {
            long: v.finished ? 'Match Finished' : 'Not Started',
            short: status,
            elapsed: v.elapsed,
            extra: null,
          },
        },
        league: {
          id: 39,
          name: 'Premier League',
          country: 'England',
          logo: 'x',
          flag: 'x',
          season: 2025,
          round: 'Regular Season - 1',
          standings: true,
        },
        teams: {
          home: { id: 1, name: 'Home', logo: 'x', winner: v.homeWinner },
          away: { id: 2, name: 'Away', logo: 'x', winner: false },
        },
        goals: v.goals,
        score: {
          halftime: v.halftime,
          fulltime: v.fulltime,
          extratime: v.extratime,
          penalty: { home: null, away: null },
        },
      },
    ],
  };
}

function buildCurlStdout(body: unknown, status = 200) {
  return `${JSON.stringify(body)}\n__EVCORE_HTTP_CODE__:${status}`;
}

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

describe('PendingBetsSettlementWorker', () => {
  const fixtureService = {
    findPendingSettlementFixtures: vi.fn(),
    syncFixtureState: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<FixtureService>;
  const bettingEngineService = {
    settleOpenBets: vi.fn().mockResolvedValue({ settled: 1 }),
  } satisfies Partial<BettingEngineService>;
  const notification = {
    sendEtlFailureAlert: vi.fn(),
  } satisfies Partial<NotificationService>;
  const config = {
    getOrThrow: vi.fn().mockReturnValue('test-api-key'),
  } satisfies Partial<ConfigService>;

  const adjustmentService = {
    runCalibrationCheck: vi.fn().mockResolvedValue({
      calibration: null,
      proposalId: null,
      shadowCorrelations: null,
      shadowProposalId: null,
    }),
  } satisfies Partial<AdjustmentService>;

  const couponSettlement = {
    settleReadyProposals: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<CouponSettlementService>;

  const cache = {
    invalidateTag: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<CacheService>;

  const worker = new PendingBetsSettlementWorker(
    fixtureService as unknown as FixtureService,
    bettingEngineService as unknown as BettingEngineService,
    adjustmentService as unknown as AdjustmentService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(worker, {
      notification: notification as unknown as NotificationService,
      apiFootball: new ApiFootballClient(config as unknown as ConfigService),
      couponSettlement: couponSettlement as unknown as CouponSettlementService,
      cache: cache as unknown as CacheService,
    });
    fixtureService.syncFixtureState.mockResolvedValue(undefined);
    bettingEngineService.settleOpenBets.mockResolvedValue({ settled: 1 });
    config.getOrThrow.mockReturnValue('test-api-key');
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        scheduledAt: new Date('2025-03-15T20:00:00Z'),
        season: {
          competition: {
            leagueId: 39,
            code: 'PL',
          },
        },
      },
    ]);
  });

  it('updates fixture state and settles bets when a fixture finishes', async () => {
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('FT')));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith({
      externalId: 999,
      scheduledAt: new Date('2025-03-15T20:00:00.000Z'),
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      homeHtScore: 1,
      awayHtScore: 0,
    });
    expect(bettingEngineService.settleOpenBets).toHaveBeenCalledWith(
      'fixture-1',
    );
  });

  it('settles on the 90-minute score, not the post-extra-time score (AET)', async () => {
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('AET')));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    // API-Football: fulltime 2-2, goals (final, incl. ET) 3-2 — must store
    // the 90-minute score so ONE_X_TWO/DOUBLE_CHANCE/DRAW settle on the draw,
    // not on the extra-time winner.
    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith({
      externalId: 999,
      scheduledAt: new Date('2025-03-15T20:00:00.000Z'),
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 2,
      homeHtScore: 1,
      awayHtScore: 0,
    });
  });

  it('only refreshes fixture state when the fixture is still scheduled', async () => {
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('NS')));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledOnce();
    expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
  });

  it('throws on non-ok API response', async () => {
    mockCurlStdoutOnce(buildCurlStdout({}, 500));

    await expect(
      worker.process({ data: {} } as Job<Record<string, never>>),
    ).resolves.toBeUndefined();

    expect(fixtureService.syncFixtureState).not.toHaveBeenCalled();
    expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
  });

  it('skips transient network errors and continues processing', async () => {
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        scheduledAt: new Date('2025-03-15T20:00:00Z'),
        season: {
          competition: {
            leagueId: 39,
            code: 'PL',
          },
        },
      },
      {
        id: 'fixture-2',
        externalId: 1000,
        scheduledAt: new Date('2025-03-15T21:00:00Z'),
        season: {
          competition: {
            leagueId: 39,
            code: 'PL',
          },
        },
      },
    ]);
    mockCurlErrorOnce('Operation timed out', 28);
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('FT')));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledOnce();
    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith({
      externalId: 1000,
      scheduledAt: new Date('2025-03-15T20:00:00.000Z'),
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      homeHtScore: 1,
      awayHtScore: 0,
    });
    expect(bettingEngineService.settleOpenBets).toHaveBeenCalledWith(
      'fixture-2',
    );
  });
});
