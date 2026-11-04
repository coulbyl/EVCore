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
import type { RollingStatsService } from '../../rolling-stats/rolling-stats.service';
import type { RiskService } from '../../risk/risk.service';
import type { FixtureEventsService } from '../../fixture-events/fixture-events.service';
import {
  LIVE_FIXTURES_JOB,
  PendingBetsSettlementWorker,
} from './pending-bets-settlement.worker';
import { LIVE_FIXTURES } from '@config/etl.constants';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('@utils/async.utils', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
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

function buildFixtureResponse(status: 'NS' | 'FT' | 'AET', id = 999) {
  const v = FIXTURE_VALUES_BY_STATUS[status];
  return {
    get: 'fixtures',
    parameters: { ids: String(id) },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id,
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

// One /fixtures?ids= answer of several fixtures.
function buildBatchResponse(
  entries: Array<{ status: 'NS' | 'FT' | 'AET'; id: number }>,
) {
  return {
    ...buildFixtureResponse('NS'),
    results: entries.length,
    response: entries.flatMap(
      ({ status, id }) => buildFixtureResponse(status, id).response,
    ),
  };
}

function pendingFixture(index: number, status = 'IN_PROGRESS') {
  return {
    id: `fixture-${index}`,
    externalId: 1000 + index,
    scheduledAt: new Date('2025-03-15T20:00:00Z'),
    status,
    hasEvents: false,
    season: { competition: { leagueId: 39, code: 'PL' } },
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

const emptyAnswer = {
  status: 'written',
  events: 0,
  lineups: 0,
  playerStatistics: 0,
  synced: false,
  dropped: { events: 0, lineups: 0, players: 0 },
} as const;

describe('PendingBetsSettlementWorker', () => {
  const fixtureService = {
    findPendingSettlementFixtures: vi.fn(),
    findLiveFixtures: vi.fn(),
    syncFixtureState: vi.fn().mockResolvedValue({
      affectsRollingStats: true,
      changed: true,
      seasonId: 'season-1',
      fixtureId: 'fixture-1',
    }),
  } satisfies Partial<FixtureService>;
  const bettingEngineService = {
    settleOpenBets: vi.fn().mockResolvedValue({ settled: 1 }),
    settleEarlyBets: vi.fn().mockResolvedValue({ settled: 0 }),
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

  const rollingStatsService = {
    refreshSeason: vi.fn().mockResolvedValue(undefined),
  } satisfies Partial<RollingStatsService>;

  const riskService = {
    checkAllMarkets: vi.fn().mockResolvedValue([]),
  } satisfies Partial<RiskService>;

  const fixtureEvents = {
    writeEntry: vi.fn(),
  } satisfies Partial<FixtureEventsService>;

  const worker = new PendingBetsSettlementWorker(
    fixtureService as unknown as FixtureService,
    bettingEngineService as unknown as BettingEngineService,
    adjustmentService as unknown as AdjustmentService,
    rollingStatsService as unknown as RollingStatsService,
    riskService as unknown as RiskService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(worker, {
      notification: notification as unknown as NotificationService,
      apiFootball: new ApiFootballClient(config as unknown as ConfigService),
      couponSettlement: couponSettlement as unknown as CouponSettlementService,
      cache: cache as unknown as CacheService,
      fixtureEvents: fixtureEvents as unknown as FixtureEventsService,
    });
    fixtureEvents.writeEntry.mockResolvedValue({
      status: 'written',
      events: 1,
      lineups: 0,
      playerStatistics: 0,
      synced: false,
      dropped: { events: 0, lineups: 0, players: 0 },
    });
    bettingEngineService.settleEarlyBets.mockResolvedValue({ settled: 0 });
    fixtureService.findLiveFixtures.mockResolvedValue([]);
    fixtureService.syncFixtureState.mockResolvedValue({
      affectsRollingStats: true,
      changed: true,
      seasonId: 'season-1',
      fixtureId: 'fixture-1',
    });
    bettingEngineService.settleOpenBets.mockResolvedValue({ settled: 1 });
    config.getOrThrow.mockReturnValue('test-api-key');
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      {
        id: 'fixture-1',
        externalId: 999,
        scheduledAt: new Date('2025-03-15T20:00:00Z'),
        status: 'IN_PROGRESS',
        hasEvents: false,
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
      live: expect.any(Object),
    });
    expect(bettingEngineService.settleOpenBets).toHaveBeenCalledWith(
      'fixture-1',
    );
    expect(rollingStatsService.refreshSeason).toHaveBeenCalledWith(
      'season-1',
      expect.objectContaining({ changedFixtureIds: expect.any(Set) }),
    );
  });

  it('writes the events of the answer that says FINISHED, before settling', async () => {
    const body = buildFixtureResponse('FT');
    Object.assign(body.response[0] ?? {}, {
      events: [
        {
          time: { elapsed: 58, extra: null },
          team: { id: 1 },
          player: { id: 1485, name: 'Bruno Fernandes' },
          assist: { id: null, name: null },
          type: 'Goal',
          detail: 'Penalty',
          comments: null,
        },
      ],
      lineups: [],
      players: [],
    });
    mockCurlStdoutOnce(buildCurlStdout(body));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureEvents.writeEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureExternalId: 999,
        entry: expect.objectContaining({
          events: [expect.objectContaining({ detail: 'Penalty' })],
        }),
      }),
    );
    expect(fixtureEvents.writeEntry.mock.invocationCallOrder[0]).toBeLessThan(
      bettingEngineService.settleOpenBets.mock.invocationCallOrder[0] ?? 0,
    );
  });

  describe('a fixture already stored FINISHED (a bet still pending)', () => {
    const finishedWithEvents = (hasEvents: boolean) => {
      fixtureService.findPendingSettlementFixtures.mockResolvedValue([
        {
          id: 'fixture-1',
          externalId: 999,
          scheduledAt: new Date('2025-03-15T20:00:00Z'),
          status: 'FINISHED',
          hasEvents,
          season: { competition: { leagueId: 39, code: 'PL' } },
        },
      ]);
      const body = buildFixtureResponse('FT');
      Object.assign(body.response[0] ?? {}, {
        events: [],
        lineups: [],
        players: [],
      });
      mockCurlStdoutOnce(buildCurlStdout(body));
    };

    it('does not write its events again', async () => {
      finishedWithEvents(true);

      await worker.process({ data: {} } as Job<Record<string, never>>);

      expect(fixtureEvents.writeEntry).not.toHaveBeenCalled();
      expect(bettingEngineService.settleOpenBets).toHaveBeenCalled();
    });

    it('writes them while it has none', async () => {
      finishedWithEvents(false);

      await worker.process({ data: {} } as Job<Record<string, never>>);

      expect(fixtureEvents.writeEntry).toHaveBeenCalledOnce();
    });
  });

  it('settles a finished fixture whose events cannot be written', async () => {
    const body = buildFixtureResponse('FT');
    Object.assign(body.response[0] ?? {}, {
      events: [],
      lineups: [],
      players: [],
    });
    mockCurlStdoutOnce(buildCurlStdout(body));
    fixtureEvents.writeEntry.mockResolvedValueOnce({
      status: 'rejected',
      cause: 'write-failed',
      reason: 'db down',
      match: 'Home – Away',
    });

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(bettingEngineService.settleOpenBets).toHaveBeenCalledWith(
      'fixture-1',
    );
  });

  it('hands the whistle answer to the one writer, even without events', async () => {
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('FT')));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    // The writer rejects a block missing and says why; the settlement goes on.
    expect(fixtureEvents.writeEntry).toHaveBeenCalledOnce();
    expect(bettingEngineService.settleOpenBets).toHaveBeenCalled();
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
      live: expect.any(Object),
    });
  });

  it('only refreshes fixture state when the fixture is still scheduled', async () => {
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('NS')));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledOnce();
    expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
  });

  it('passes the clock of a match in progress', async () => {
    const body = buildFixtureResponse('NS');
    Object.assign(body.response[0]?.fixture.status ?? {}, {
      short: '2H',
      elapsed: 67,
    });
    mockCurlStdoutOnce(buildCurlStdout(body));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'IN_PROGRESS',
        live: { status: '2H', elapsed: 67 },
      }),
    );
  });

  it('throws on non-ok API response', async () => {
    mockCurlStdoutOnce(buildCurlStdout({}, 500));

    await expect(
      worker.process({ data: {} } as Job<Record<string, never>>),
    ).resolves.toBeUndefined();

    expect(fixtureService.syncFixtureState).not.toHaveBeenCalled();
    expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
  });

  it('skips a batch on a transient network error, settling nothing of it', async () => {
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      pendingFixture(1),
      pendingFixture(2),
    ]);
    mockCurlErrorOnce('Operation timed out', 28);

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).not.toHaveBeenCalled();
    expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
    // The settlement pass still settles the coupons ready from before.
    expect(couponSettlement.settleReadyProposals).toHaveBeenCalledOnce();
  });

  it('asks 20 fixtures per /fixtures?ids= call, one call for 20', async () => {
    const fixtures = Array.from({ length: 21 }, (_, i) => pendingFixture(i));
    fixtureService.findPendingSettlementFixtures.mockResolvedValue(fixtures);
    mockCurlStdoutOnce(
      buildCurlStdout(
        buildBatchResponse(
          fixtures.slice(0, 20).map(({ externalId }) => ({
            status: 'FT' as const,
            id: externalId,
          })),
        ),
      ),
    );
    mockCurlStdoutOnce(
      buildCurlStdout(buildBatchResponse([{ status: 'NS', id: 1020 }])),
    );

    await worker.process({ data: {} } as Job<Record<string, never>>);

    const urls = vi
      .mocked(execFile)
      .mock.calls.map(([, args]) =>
        (args as string[]).find((a) => a.includes('/fixtures?ids=')),
      );
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain(
      `ids=${fixtures
        .slice(0, 20)
        .map(({ externalId }) => externalId)
        .join('-')}`,
    );
    expect(urls[1]).toContain('ids=1020');
    expect(fixtureService.syncFixtureState).toHaveBeenCalledTimes(21);
    expect(bettingEngineService.settleOpenBets).toHaveBeenCalledTimes(20);
  });

  it('settles a fixture of the answer even when another entry is malformed', async () => {
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      pendingFixture(1),
      pendingFixture(2),
    ]);
    const body = buildBatchResponse([
      { status: 'FT', id: 1001 },
      { status: 'FT', id: 1002 },
    ]);
    Object.assign(body.response[0]?.fixture ?? {}, { date: 'not a date' });
    mockCurlStdoutOnce(buildCurlStdout(body));

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledOnce();
    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 1002 }),
    );
  });

  it('stops at a quota answer, keeping the batches before it', async () => {
    const fixtures = Array.from({ length: 21 }, (_, i) => pendingFixture(i));
    fixtureService.findPendingSettlementFixtures.mockResolvedValue(fixtures);
    mockCurlStdoutOnce(
      buildCurlStdout(
        buildBatchResponse(
          fixtures.slice(0, 20).map(({ externalId }) => ({
            status: 'NS' as const,
            id: externalId,
          })),
        ),
      ),
    );
    mockCurlStdoutOnce(
      buildCurlStdout({
        ...buildBatchResponse([]),
        errors: { requests: 'You have reached the request limit for the day' },
      }),
    );

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledTimes(20);
  });

  it('settles twice without settling twice: a second pass on the same answer', async () => {
    // The bets settle on a transition (settleOpenBets reads PENDING only):
    // a replay of the pass finds nothing left.
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('FT')));
    mockCurlStdoutOnce(buildCurlStdout(buildFixtureResponse('FT')));
    bettingEngineService.settleOpenBets
      .mockResolvedValueOnce({ settled: 1 })
      .mockResolvedValueOnce({ settled: 0 });

    await worker.process({ data: {} } as Job<Record<string, never>>);
    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(adjustmentService.runCalibrationCheck).toHaveBeenCalledOnce();
  });

  it('leaves the matches the live pass follows out of the settlement pass', async () => {
    fixtureService.findPendingSettlementFixtures.mockResolvedValue([
      pendingFixture(1),
      pendingFixture(2),
    ]);
    fixtureService.findLiveFixtures.mockResolvedValue([pendingFixture(1)]);
    mockCurlStdoutOnce(
      buildCurlStdout(buildBatchResponse([{ status: 'FT', id: 1002 }])),
    );

    await worker.process({ data: {} } as Job<Record<string, never>>);

    expect(fixtureService.syncFixtureState).toHaveBeenCalledOnce();
    expect(fixtureService.syncFixtureState).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 1002 }),
    );
    // Its coupons settle anyway: the settlement pass always does.
    expect(couponSettlement.settleReadyProposals).toHaveBeenCalledOnce();
  });

  describe('the live pass', () => {
    const liveJob = { name: LIVE_FIXTURES_JOB, data: {} } as Job<
      Record<string, never>
    >;

    it('settles no coupon again for a finished match retried for its events', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([
        pendingFixture(1, 'FINISHED'),
      ]);
      fixtureService.syncFixtureState.mockResolvedValue({
        affectsRollingStats: false,
        changed: false,
        seasonId: 'season-1',
        fixtureId: 'fixture-1',
      });
      fixtureEvents.writeEntry.mockResolvedValue(emptyAnswer);
      mockCurlStdoutOnce(
        buildCurlStdout(buildBatchResponse([{ status: 'FT', id: 1001 }])),
      );

      await worker.process(liveJob);

      expect(fixtureEvents.writeEntry).toHaveBeenCalledOnce();
      expect(bettingEngineService.settleOpenBets).not.toHaveBeenCalled();
      expect(couponSettlement.settleReadyProposals).not.toHaveBeenCalled();
    });

    it('settles the coupons when the events of a finished match arrive', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([
        pendingFixture(1, 'FINISHED'),
      ]);
      fixtureService.syncFixtureState.mockResolvedValue({
        affectsRollingStats: false,
        changed: false,
        seasonId: 'season-1',
        fixtureId: 'fixture-1',
      });
      bettingEngineService.settleOpenBets.mockResolvedValue({ settled: 0 });
      mockCurlStdoutOnce(
        buildCurlStdout(buildBatchResponse([{ status: 'FT', id: 1001 }])),
      );

      await worker.process(liveJob);

      expect(couponSettlement.settleReadyProposals).toHaveBeenCalledOnce();
    });

    it('gives up on a finished match answered without events, the settlement pass too', async () => {
      const finished = pendingFixture(1, 'FINISHED');
      fixtureService.findLiveFixtures.mockResolvedValue([finished]);
      fixtureService.findPendingSettlementFixtures.mockResolvedValue([]);
      fixtureEvents.writeEntry.mockResolvedValue(emptyAnswer);
      for (let i = 0; i < LIVE_FIXTURES.MAX_EMPTY_EVENTS_ANSWERS; i++) {
        mockCurlStdoutOnce(
          buildCurlStdout(buildBatchResponse([{ status: 'FT', id: 1001 }])),
        );
        await worker.process(liveJob);
      }
      expect(execFile).toHaveBeenCalledTimes(
        LIVE_FIXTURES.MAX_EMPTY_EVENTS_ANSWERS,
      );

      await worker.process(liveJob);

      // Out of the live pass: no call, and nothing left for the coupons.
      expect(execFile).toHaveBeenCalledTimes(
        LIVE_FIXTURES.MAX_EMPTY_EVENTS_ANSWERS,
      );
      // Out of the window, its count is forgotten.
      fixtureService.findLiveFixtures.mockResolvedValue([]);
      await worker.process(liveJob);
      fixtureService.findLiveFixtures.mockResolvedValue([finished]);
      mockCurlStdoutOnce(
        buildCurlStdout(buildBatchResponse([{ status: 'FT', id: 1001 }])),
      );
      await worker.process(liveJob);
      expect(execFile).toHaveBeenCalledTimes(
        LIVE_FIXTURES.MAX_EMPTY_EVENTS_ANSWERS + 1,
      );
    });

    it('settles early bets only when the score moved', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([pendingFixture(1)]);
      const inPlay = () =>
        buildCurlStdout(
          (() => {
            const body = buildBatchResponse([{ status: 'FT', id: 1001 }]);
            Object.assign(body.response[0]?.fixture.status ?? {}, {
              short: '2H',
              long: 'Second Half',
              elapsed: 60,
            });
            return body;
          })(),
        );
      mockCurlStdoutOnce(inPlay());
      await worker.process(liveJob);
      expect(bettingEngineService.settleEarlyBets).toHaveBeenCalledOnce();

      fixtureService.syncFixtureState.mockResolvedValue({
        affectsRollingStats: false,
        changed: false,
        seasonId: 'season-1',
        fixtureId: 'fixture-1',
      });
      mockCurlStdoutOnce(inPlay());
      await worker.process(liveJob);
      expect(bettingEngineService.settleEarlyBets).toHaveBeenCalledOnce();
    });
    it('asks nothing and settles nothing when no match has kicked off', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([]);

      await worker.process(liveJob);

      expect(execFile).not.toHaveBeenCalled();
      expect(couponSettlement.settleReadyProposals).not.toHaveBeenCalled();
      expect(
        fixtureService.findPendingSettlementFixtures,
      ).not.toHaveBeenCalled();
    });

    it('follows the matches kicked off within its window', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([]);
      const before = Date.now();

      await worker.process(liveJob);

      const [input] = fixtureService.findLiveFixtures.mock.calls[0] ?? [];
      expect((input?.now.getTime() ?? 0) - (input?.since.getTime() ?? 0)).toBe(
        LIVE_FIXTURES.WINDOW_HOURS * 3_600_000,
      );
      expect(input?.now.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('stores the clock of a match in progress without settling coupons', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([pendingFixture(1)]);
      const body = buildBatchResponse([{ status: 'NS', id: 1001 }]);
      Object.assign(body.response[0]?.fixture.status ?? {}, {
        short: '1H',
        elapsed: 23,
      });
      mockCurlStdoutOnce(buildCurlStdout(body));

      await worker.process(liveJob);

      expect(fixtureService.syncFixtureState).toHaveBeenCalledWith(
        expect.objectContaining({ live: { status: '1H', elapsed: 23 } }),
      );
      expect(couponSettlement.settleReadyProposals).not.toHaveBeenCalled();
    });

    it('settles a match at the whistle, its coupons at once, the calibration on the next settlement pass', async () => {
      fixtureService.findLiveFixtures.mockResolvedValue([pendingFixture(1)]);
      mockCurlStdoutOnce(
        buildCurlStdout(buildBatchResponse([{ status: 'FT', id: 1001 }])),
      );

      await worker.process(liveJob);

      expect(bettingEngineService.settleOpenBets).toHaveBeenCalledWith(
        'fixture-1',
      );
      expect(fixtureEvents.writeEntry).toHaveBeenCalledOnce();
      expect(couponSettlement.settleReadyProposals).toHaveBeenCalledOnce();
      expect(adjustmentService.runCalibrationCheck).not.toHaveBeenCalled();

      // The settlement pass after it: the bet is no longer pending, but the
      // calibration check still runs once for it.
      fixtureService.findPendingSettlementFixtures.mockResolvedValue([]);
      await worker.process({ data: {} } as Job<Record<string, never>>);
      expect(adjustmentService.runCalibrationCheck).toHaveBeenCalledOnce();

      await worker.process({ data: {} } as Job<Record<string, never>>);
      expect(adjustmentService.runCalibrationCheck).toHaveBeenCalledOnce();
    });
  });
});
