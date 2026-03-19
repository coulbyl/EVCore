/* eslint-disable @typescript-eslint/require-await */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { CouponStatus, Market } from '@evcore/db';
import { CouponService } from './coupon.service';
import type { CouponRepository } from './coupon.repository';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { FixtureService } from '@modules/fixture/fixture.service';
import type { NotificationService } from '@modules/notification/notification.service';
import type { PrismaService } from '@/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

function makeValueBet(
  fixtureId: string,
  qualityScore: string,
  modelRunId = `run-${fixtureId}`,
) {
  return {
    fixtureId,
    modelRunId,
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    pickKey: 'ONE_X_TWO:HOME',
    comboMarket: null,
    comboPick: null,
    probability: new Decimal('0.55'),
    odds: new Decimal('2.20'),
    ev: new Decimal('0.21'),
    stakePct: new Decimal('0.01'),
    qualityScore: new Decimal(qualityScore),
  };
}

function makeQueue(): Queue {
  return {
    upsertJobScheduler: vi.fn().mockResolvedValue(undefined),
  } as unknown as Queue;
}

function makeConfig(schedulingEnabled = false): ConfigService {
  return {
    get: vi.fn().mockReturnValue(schedulingEnabled ? 'true' : 'false'),
  } as unknown as ConfigService;
}

function makeDeps(
  overrides: Partial<{
    couponRepository: Partial<CouponRepository>;
    bettingEngineService: Partial<BettingEngineService>;
    fixtureService: Partial<FixtureService>;
    notificationService: Partial<NotificationService>;
    prisma: Partial<{ client: Record<string, unknown> }>;
  }> = {},
) {
  const couponRepository: CouponRepository = {
    findLatestByDate: vi.fn().mockResolvedValue(null),
    findCouponsForDate: vi.fn().mockResolvedValue([]),
    findPendingFixtureIdsForWindow: vi.fn().mockResolvedValue(new Set()),
    findPendingCouponsUntil: vi.fn().mockResolvedValue([]),
    findPendingCouponsByFixture: vi.fn().mockResolvedValue([]),
    findCouponById: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'coupon-id' }),
    createPendingCouponWithBets: vi
      .fn()
      .mockResolvedValue({ id: 'coupon-id', code: 'CPN-TEST', betIds: [] }),
    ...overrides.couponRepository,
  } as unknown as CouponRepository;

  const bettingEngineService: BettingEngineService = {
    analyzeFixture: vi.fn().mockResolvedValue({
      status: 'analyzed',
      fixtureId: 'fixture-1',
      modelRunId: 'run-1',
      decision: 'NO_BET',
      deterministicScore: 0.5,
      probabilities: {},
      valueBet: null,
    }),
    ...overrides.bettingEngineService,
  } as unknown as BettingEngineService;

  const fixtureService: FixtureService = {
    findScheduledForDate: vi.fn().mockResolvedValue([]),
    findScheduledInRange: vi.fn().mockResolvedValue([]),
    ...overrides.fixtureService,
  } as unknown as FixtureService;

  const notificationService: NotificationService = {
    sendNoBetToday: vi.fn().mockResolvedValue(undefined),
    sendDailyCoupon: vi.fn().mockResolvedValue(undefined),
    sendCouponResult: vi.fn().mockResolvedValue(undefined),
    ...overrides.notificationService,
  } as unknown as NotificationService;

  const prisma: PrismaService = {
    client: {
      bet: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      ...overrides.prisma?.client,
    },
  } as unknown as PrismaService;

  return {
    couponRepository,
    bettingEngineService,
    fixtureService,
    notificationService,
    prisma,
  };
}

function makeService(
  deps = makeDeps(),
  queue = makeQueue(),
  config = makeConfig(),
): CouponService {
  return new CouponService(
    queue,
    deps.couponRepository,
    deps.bettingEngineService,
    deps.fixtureService,
    deps.notificationService,
    deps.prisma,
    config,
  );
}

const TEST_DATE = new Date('2025-08-01T00:00:00.000Z');
const TEST_KICKOFF = new Date('2025-08-01T16:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-08-01T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CouponService.generateDailyCoupon', () => {
  it('sends no-bet notification when no fixtures are scheduled', async () => {
    const deps = makeDeps({
      fixtureService: { findScheduledForDate: vi.fn().mockResolvedValue([]) },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.notificationService.sendNoBetToday).toHaveBeenCalledWith(
      TEST_DATE,
    );
    expect(deps.couponRepository.create).not.toHaveBeenCalled();
    expect(
      deps.couponRepository.createPendingCouponWithBets,
    ).not.toHaveBeenCalled();
  });

  it('sends no-bet notification when no picks pass EV threshold', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      // analyzeFixture returns NO_BET → no bet created → bet query returns []
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.notificationService.sendNoBetToday).toHaveBeenCalled();
    expect(deps.couponRepository.create).not.toHaveBeenCalled();
  });

  it('creates a PENDING coupon when viable picks exist', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      bettingEngineService: {
        analyzeFixture: vi.fn().mockResolvedValue({
          status: 'analyzed',
          fixtureId: 'f-1',
          modelRunId: 'run-1',
          decision: 'BET',
          deterministicScore: 0.7,
          probabilities: {},
          valueBet: makeValueBet('f-1', '0.084'),
        }),
      },
      couponRepository: {
        createPendingCouponWithBets: vi.fn().mockResolvedValue({
          id: 'coupon-id',
          code: 'CPN-TEST',
          betIds: ['bet-1'],
        }),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(
      deps.couponRepository.createPendingCouponWithBets,
    ).toHaveBeenCalledWith(expect.objectContaining({ legCount: 1 }));
    expect(deps.notificationService.sendDailyCoupon).toHaveBeenCalled();
  });

  it('respects COUPON_MAX_LEGS (caps at 6 picks)', async () => {
    // 8 fixtures with bets → only 6 should be selected
    const fixtures = Array.from({ length: 8 }, (_, i) => ({
      id: `f-${i}`,
      externalId: i + 1,
      scheduledAt: new Date(
        `2025-08-01T${String(12 + i).padStart(2, '0')}:00:00.000Z`,
      ),
    }));

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(fixtures),
      },
      bettingEngineService: {
        analyzeFixture: vi
          .fn()
          .mockImplementation(async (fixtureId: string) => ({
            status: 'analyzed',
            fixtureId,
            modelRunId: `run-${fixtureId}`,
            decision: 'BET',
            deterministicScore: 0.7,
            probabilities: {},
            valueBet: makeValueBet(fixtureId, '0.084'),
          })),
      },
      couponRepository: {
        createPendingCouponWithBets: vi
          .fn()
          .mockResolvedValue({ id: 'coupon-id', code: 'CPN-TEST', betIds: [] }),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(
      deps.couponRepository.createPendingCouponWithBets,
    ).toHaveBeenCalledWith(expect.objectContaining({ legCount: 6 }));
  });

  it('sorts picks by qualityScore DESC', async () => {
    const fixtures = [
      {
        id: 'f-a',
        externalId: 1,
        scheduledAt: new Date('2025-08-01T15:00:00.000Z'),
      },
      { id: 'f-b', externalId: 2, scheduledAt: TEST_KICKOFF },
    ];

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(fixtures),
      },
      bettingEngineService: {
        analyzeFixture: vi
          .fn()
          .mockImplementation(async (fixtureId: string) => ({
            status: 'analyzed',
            fixtureId,
            modelRunId: `run-${fixtureId}`,
            decision: 'BET',
            deterministicScore: fixtureId === 'f-a' ? 0.6 : 0.8,
            probabilities: {},
            // f-b has higher qualityScore (0.16) than f-a (0.06)
            valueBet: makeValueBet(
              fixtureId,
              fixtureId === 'f-a' ? '0.06' : '0.16',
            ),
          })),
      },
      couponRepository: {
        createPendingCouponWithBets: vi
          .fn()
          .mockResolvedValue({ id: 'coupon-id', code: 'CPN-TEST', betIds: [] }),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    // bets should be passed in qualityScore DESC order (f-b first)
    const [callInput] = (
      deps.couponRepository.createPendingCouponWithBets as ReturnType<
        typeof vi.fn
      >
    ).mock.calls[0] as [{ bets: { fixtureId: string }[] }];
    const linkedBets = callInput.bets;
    expect(linkedBets[0]?.fixtureId).toBe('f-b');
    expect(linkedBets[1]?.fixtureId).toBe('f-a');
  });

  it('supports multi-day windows (2-3 days) via range query', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledInRange: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      bettingEngineService: {
        analyzeFixture: vi.fn().mockResolvedValue({
          status: 'analyzed',
          fixtureId: 'f-1',
          modelRunId: 'run-1',
          decision: 'BET',
          deterministicScore: 0.7,
          probabilities: {},
          valueBet: makeValueBet('f-1', '0.105'),
        }),
      },
      couponRepository: {
        createPendingCouponWithBets: vi
          .fn()
          .mockResolvedValue({ id: 'coupon-id', code: 'CPN-TEST', betIds: [] }),
      },
    });
    const service = makeService(deps);

    await service.generateCouponWindow({ startDate: TEST_DATE, days: 3 });

    expect(deps.fixtureService.findScheduledInRange).toHaveBeenCalledTimes(1);
    expect(deps.fixtureService.findScheduledForDate).not.toHaveBeenCalled();
    expect(
      deps.couponRepository.createPendingCouponWithBets,
    ).toHaveBeenCalledWith(expect.objectContaining({ legCount: 1 }));
  });

  it('excludes fixtures already assigned to an existing PENDING coupon', async () => {
    // f-1 is already in a PENDING coupon; f-2 is available
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue([
          { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          {
            id: 'f-2',
            externalId: 2,
            scheduledAt: new Date('2025-08-01T17:00:00.000Z'),
          },
        ]),
      },
      couponRepository: {
        findPendingFixtureIdsForWindow: vi
          .fn()
          .mockResolvedValue(new Set(['f-1'])),
        createPendingCouponWithBets: vi
          .fn()
          .mockResolvedValue({ id: 'coupon-id', code: 'CPN-TEST', betIds: [] }),
      },
      bettingEngineService: {
        analyzeFixture: vi.fn().mockResolvedValue({
          status: 'analyzed',
          fixtureId: 'f-2',
          modelRunId: 'run-2',
          decision: 'BET',
          deterministicScore: 0.7,
          probabilities: {},
          valueBet: makeValueBet('f-2', '0.105'),
        }),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    // Only f-2 should be analyzed (f-1 was excluded)
    expect(deps.bettingEngineService.analyzeFixture).toHaveBeenCalledTimes(1);
    expect(deps.bettingEngineService.analyzeFixture).toHaveBeenCalledWith(
      'f-2',
    );
    expect(
      deps.couponRepository.createPendingCouponWithBets,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        bets: expect.arrayContaining([
          expect.objectContaining({ fixtureId: 'f-2' }),
        ]),
      }),
    );
  });

  it('excludes fixtures that started more than 30 minutes ago', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-08-01T16:31:00.000Z'));

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue([
          {
            id: 'stale-fixture',
            externalId: 1,
            scheduledAt: new Date('2025-08-01T16:00:00.000Z'),
          },
          {
            id: 'fresh-fixture',
            externalId: 2,
            scheduledAt: new Date('2025-08-01T16:15:00.000Z'),
          },
        ]),
      },
      bettingEngineService: {
        analyzeFixture: vi.fn().mockResolvedValue({
          status: 'analyzed',
          fixtureId: 'fresh-fixture',
          modelRunId: 'run-fresh',
          decision: 'NO_BET',
          deterministicScore: 0.5,
          probabilities: {},
          valueBet: null,
        }),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.bettingEngineService.analyzeFixture).toHaveBeenCalledTimes(1);
    expect(deps.bettingEngineService.analyzeFixture).toHaveBeenCalledWith(
      'fresh-fixture',
    );
  });
});

describe('CouponService.onApplicationBootstrap', () => {
  it('registers job scheduler when scheduling is enabled', async () => {
    const queue = makeQueue();
    const deps = makeDeps();
    const config = makeConfig(true);
    const service = makeService(deps, queue, config);

    await service.onApplicationBootstrap();

    expect(queue.upsertJobScheduler).toHaveBeenCalledOnce();
  });

  it('skips scheduler when COUPON_SCHEDULING_ENABLED=false', async () => {
    const queue = makeQueue();
    const deps = makeDeps();
    const config = makeConfig(false);
    const service = makeService(deps, queue, config);

    await service.onApplicationBootstrap();

    expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
  });
});

describe('CouponService settlement', () => {
  it('settles pending coupons with resolved bets and emits result notification', async () => {
    const deps = makeDeps({
      couponRepository: {
        findPendingCouponsUntil: vi.fn().mockResolvedValue([
          {
            id: 'c-won',
            status: CouponStatus.PENDING,
            bets: [{ id: 'b1', status: 'WON' }],
          },
          {
            id: 'c-lost',
            status: CouponStatus.PENDING,
            bets: [
              { id: 'b2', status: 'WON' },
              { id: 'b3', status: 'LOST' },
            ],
          },
          {
            id: 'c-settled',
            status: CouponStatus.PENDING,
            bets: [
              { id: 'b4', status: 'VOID' },
              { id: 'b5', status: 'VOID' },
            ],
          },
          {
            id: 'c-pending',
            status: CouponStatus.PENDING,
            bets: [{ id: 'b6', status: 'PENDING' }],
          },
        ]),
      },
    });
    const service = makeService(deps);

    const result = await service.settleExpiredCoupons(TEST_DATE);

    expect(result).toEqual({ settledCount: 3 });
    expect(deps.couponRepository.updateStatus).toHaveBeenCalledWith(
      'c-won',
      CouponStatus.WON,
    );
    expect(deps.couponRepository.updateStatus).toHaveBeenCalledWith(
      'c-lost',
      CouponStatus.LOST,
    );
    expect(deps.couponRepository.updateStatus).toHaveBeenCalledWith(
      'c-settled',
      CouponStatus.SETTLED,
    );
    expect(deps.notificationService.sendCouponResult).toHaveBeenCalledTimes(3);
  });

  it('settles a coupon manually by id when all bets are resolved', async () => {
    const deps = makeDeps({
      couponRepository: {
        findCouponById: vi.fn().mockResolvedValue({
          id: 'coupon-id',
          status: CouponStatus.PENDING,
          bets: [
            { id: 'b1', status: 'WON' },
            { id: 'b2', status: 'WON' },
          ],
        }),
      },
    });
    const service = makeService(deps);

    const result = await service.settleCouponById('coupon-id');

    expect(result).toEqual({
      couponId: 'coupon-id',
      status: CouponStatus.WON,
      settled: true,
    });
    expect(deps.couponRepository.updateStatus).toHaveBeenCalledWith(
      'coupon-id',
      CouponStatus.WON,
    );
    expect(deps.notificationService.sendCouponResult).toHaveBeenCalledWith(
      'coupon-id',
    );
  });
});

describe('CouponService listCouponsByPeriod', () => {
  it('includes probEstimated in coupon selections', async () => {
    const deps = makeDeps({
      couponRepository: {
        findCouponsByDateRange: vi.fn().mockResolvedValue([
          {
            id: 'coupon-1',
            code: 'CPN-TEST',
            date: new Date('2026-03-15T00:00:00.000Z'),
            status: 'PENDING',
            bets: [
              {
                id: 'bet-1',
                market: 'OVER_UNDER',
                pick: 'UNDER',
                comboMarket: null,
                comboPick: null,
                probEstimated: new Decimal('0.4123'),
                oddsSnapshot: new Decimal('3.26'),
                ev: new Decimal('0.328'),
                status: 'PENDING',
                modelRun: {
                  features: {
                    lambdaHome: 1.18,
                    lambdaAway: 1.07,
                    candidatePicks: [
                      {
                        market: 'OVER_UNDER',
                        pick: 'UNDER',
                        probability: 0.4123,
                        odds: 3.26,
                        ev: 0.328,
                        qualityScore: 0.2296,
                      },
                      {
                        market: 'BTTS',
                        pick: 'NO',
                        probability: 0.488,
                        odds: 2.45,
                        ev: 0.1956,
                        qualityScore: 0.1369,
                      },
                    ],
                    evaluatedPicks: [
                      {
                        market: 'OVER_UNDER',
                        pick: 'UNDER',
                        probability: 0.4123,
                        odds: 3.26,
                        ev: 0.328,
                        qualityScore: 0.2296,
                        status: 'viable',
                      },
                      {
                        market: 'ONE_X_TWO',
                        pick: 'HOME',
                        probability: 0.39,
                        odds: 2.25,
                        ev: -0.1225,
                        qualityScore: -0.0858,
                        status: 'rejected',
                        rejectionReason: 'ev_below_threshold',
                      },
                    ],
                  },
                  fixture: {
                    id: 'fixture-1',
                    scheduledAt: new Date('2026-03-15T16:30:00.000Z'),
                    homeTeam: { name: 'Liverpool' },
                    awayTeam: { name: 'Tottenham' },
                  },
                },
              },
            ],
          },
        ]),
      },
    });
    const service = makeService(deps);

    const result = await service.listCouponsByPeriod({
      from: '2026-03-15',
      to: '2026-03-15',
    });

    expect(result.coupons[0]?.selections[0]).toMatchObject({
      probEstimated: '41.2%',
      lambdaHome: '1.18',
      lambdaAway: '1.07',
      expectedTotalGoals: '2.25',
      odds: '3.26',
      ev: '+0.328',
      candidatePicks: [
        {
          market: 'OVER_UNDER',
          pick: 'UNDER',
          probability: '0.4123',
          odds: '3.26',
          ev: '+0.3280',
          qualityScore: '0.2296',
        },
        {
          market: 'BTTS',
          pick: 'NO',
          probability: '0.4880',
          odds: '2.45',
          ev: '+0.1956',
          qualityScore: '0.1369',
        },
      ],
      evaluatedPicks: [
        {
          market: 'OVER_UNDER',
          pick: 'UNDER',
          probability: '0.4123',
          odds: '3.26',
          ev: '+0.3280',
          qualityScore: '0.2296',
          status: 'viable',
        },
        {
          market: 'ONE_X_TWO',
          pick: 'HOME',
          probability: '0.3900',
          odds: '2.25',
          ev: '-0.1225',
          qualityScore: '-0.0858',
          status: 'rejected',
          rejectionReason: 'ev_below_threshold',
        },
      ],
    });
  });

  it('includes candidate picks in coupon detail', async () => {
    const deps = makeDeps({
      couponRepository: {
        findCouponById: vi.fn().mockResolvedValue({
          id: 'coupon-1',
          date: new Date('2026-03-15T00:00:00.000Z'),
          status: 'PENDING',
          legCount: 1,
          createdAt: new Date('2026-03-15T13:34:21.466Z'),
          bets: [
            {
              id: 'bet-1',
              market: 'OVER_UNDER',
              pick: 'UNDER',
              comboMarket: null,
              comboPick: null,
              probEstimated: new Decimal('0.4123'),
              oddsSnapshot: new Decimal('3.26'),
              ev: new Decimal('0.3280'),
              status: 'PENDING',
              modelRun: {
                features: {
                  lambdaHome: 1.18,
                  lambdaAway: 1.07,
                  candidatePicks: [
                    {
                      market: 'OVER_UNDER',
                      pick: 'UNDER',
                      probability: 0.4123,
                      odds: 3.26,
                      ev: 0.328,
                      qualityScore: 0.2296,
                    },
                    {
                      market: 'ONE_X_TWO',
                      pick: 'HOME',
                      probability: 0.51,
                      odds: 2.15,
                      ev: 0.0965,
                      qualityScore: 0.0676,
                    },
                  ],
                  evaluatedPicks: [
                    {
                      market: 'OVER_UNDER',
                      pick: 'UNDER',
                      probability: 0.4123,
                      odds: 3.26,
                      ev: 0.328,
                      qualityScore: 0.2296,
                      status: 'viable',
                    },
                    {
                      market: 'BTTS',
                      pick: 'YES',
                      probability: 0.44,
                      odds: 2.1,
                      ev: -0.076,
                      qualityScore: -0.0532,
                      status: 'rejected',
                      rejectionReason: 'ev_below_threshold',
                    },
                  ],
                },
                fixture: {
                  scheduledAt: new Date('2026-03-15T16:30:00.000Z'),
                  homeTeam: { name: 'Liverpool' },
                  awayTeam: { name: 'Tottenham' },
                },
              },
            },
          ],
        }),
      },
    });
    const service = makeService(deps);

    const result = await service.getCouponById('coupon-1');

    expect(result?.bets[0]).toMatchObject({
      probEstimated: '0.4123',
      lambdaHome: '1.18',
      lambdaAway: '1.07',
      expectedTotalGoals: '2.25',
      candidatePicks: [
        {
          market: 'OVER_UNDER',
          pick: 'UNDER',
          probability: '0.4123',
          odds: '3.26',
          ev: '+0.3280',
          qualityScore: '0.2296',
        },
        {
          market: 'ONE_X_TWO',
          pick: 'HOME',
          probability: '0.5100',
          odds: '2.15',
          ev: '+0.0965',
          qualityScore: '0.0676',
        },
      ],
      evaluatedPicks: [
        {
          market: 'OVER_UNDER',
          pick: 'UNDER',
          probability: '0.4123',
          odds: '3.26',
          ev: '+0.3280',
          qualityScore: '0.2296',
          status: 'viable',
        },
        {
          market: 'BTTS',
          pick: 'YES',
          probability: '0.4400',
          odds: '2.10',
          ev: '-0.0760',
          qualityScore: '-0.0532',
          status: 'rejected',
          rejectionReason: 'ev_below_threshold',
        },
      ],
    });
  });
});
