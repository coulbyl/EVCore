import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { CouponStatus, CouponTier, Market } from '@evcore/db';
import { CouponService } from './coupon.service';
import type { CouponRepository, EligibleBet } from './coupon.repository';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { FixtureService } from '@modules/fixture/fixture.service';
import type { NotificationService } from '@modules/notification/notification.service';
import type { PrismaService } from '@/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

function makeEligibleBet(
  id: string,
  fixtureId: string,
  qualityScore: string,
): EligibleBet {
  return {
    id,
    fixtureId,
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    comboMarket: null,
    comboPick: null,
    probEstimated: '0.5500',
    oddsSnapshot: '2.200',
    ev: '0.2100',
    qualityScore,
    stakePct: '0.0100',
    modelRunId: `run-${fixtureId}`,
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
    findEligibleBetsForCoupon: vi.fn().mockResolvedValue([]),
    findEligibleSafeValueBetsForCoupon: vi.fn().mockResolvedValue([]),
    createCouponAndLinkBets: vi
      .fn()
      .mockResolvedValue({ id: 'coupon-id', code: 'CPN-TEST' }),
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
    expect(
      deps.couponRepository.createCouponAndLinkBets,
    ).not.toHaveBeenCalled();
  });

  it('sends no-bet notification when pool is empty (no eligible bets)', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi.fn().mockResolvedValue([]),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.notificationService.sendNoBetToday).toHaveBeenCalled();
    expect(
      deps.couponRepository.createCouponAndLinkBets,
    ).not.toHaveBeenCalled();
  });

  it('creates a PENDING coupon when the pool has one eligible bet', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi
          .fn()
          .mockResolvedValue([makeEligibleBet('bet-1', 'f-1', '0.240')]),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.couponRepository.createCouponAndLinkBets).toHaveBeenCalledWith(
      expect.objectContaining({ betIds: ['bet-1'], tier: CouponTier.PREMIUM }),
    );
    expect(deps.notificationService.sendDailyCoupon).toHaveBeenCalledTimes(1);
  });

  it('splits pool into chunks of COUPON_MAX_LEGS (3) — 8 bets → 3 coupons', async () => {
    const fixtures = Array.from({ length: 8 }, (_, i) => ({
      id: `f-${i}`,
      externalId: i + 1,
      scheduledAt: TEST_KICKOFF,
    }));
    const pool = fixtures.map((f, i) =>
      makeEligibleBet(`bet-${i}`, f.id, `0.${String(20 - i).padStart(3, '0')}`),
    );

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(fixtures),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi.fn().mockResolvedValue(pool),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    // 8 bets → 3 coupons: [3, 3, 2]
    expect(deps.couponRepository.createCouponAndLinkBets).toHaveBeenCalledTimes(
      3,
    );
    const calls = (
      deps.couponRepository.createCouponAndLinkBets as ReturnType<typeof vi.fn>
    ).mock.calls as [{ betIds: string[] }][];
    expect(calls[0][0].betIds).toHaveLength(3);
    expect(calls[1][0].betIds).toHaveLength(3);
    expect(calls[2][0].betIds).toHaveLength(2);
  });

  it('assigns tier based on avg qualityScore of the chunk', async () => {
    // chunk 1: avg quality 0.25 → PREMIUM; chunk 2: avg 0.10 → SPECULATIF
    const pool = [
      makeEligibleBet('b1', 'f-1', '0.280'),
      makeEligibleBet('b2', 'f-2', '0.250'),
      makeEligibleBet('b3', 'f-3', '0.220'),
      makeEligibleBet('b4', 'f-4', '0.120'),
      makeEligibleBet('b5', 'f-5', '0.100'),
      makeEligibleBet('b6', 'f-6', '0.080'),
    ];

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(
          pool.map((b) => ({
            id: b.fixtureId,
            externalId: 1,
            scheduledAt: TEST_KICKOFF,
          })),
        ),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi.fn().mockResolvedValue(pool),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    const calls = (
      deps.couponRepository.createCouponAndLinkBets as ReturnType<typeof vi.fn>
    ).mock.calls as [{ tier: CouponTier }][];
    expect(calls[0][0].tier).toBe(CouponTier.PREMIUM); // avg 0.25
    expect(calls[1][0].tier).toBe(CouponTier.SPECULATIF); // avg 0.10
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
      couponRepository: {
        findEligibleBetsForCoupon: vi
          .fn()
          .mockResolvedValue([makeEligibleBet('bet-1', 'f-1', '0.150')]),
      },
    });
    const service = makeService(deps);

    await service.generateCouponWindow({ startDate: TEST_DATE, days: 3 });

    expect(deps.fixtureService.findScheduledInRange).toHaveBeenCalledTimes(1);
    expect(deps.fixtureService.findScheduledForDate).not.toHaveBeenCalled();
    expect(deps.couponRepository.createCouponAndLinkBets).toHaveBeenCalledWith(
      expect.objectContaining({ betIds: ['bet-1'] }),
    );
  });

  it('passes all fixture IDs to findEligibleBetsForCoupon', async () => {
    const fixtures = [
      { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
      { id: 'f-2', externalId: 2, scheduledAt: TEST_KICKOFF },
    ];
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(fixtures),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(
      deps.couponRepository.findEligibleBetsForCoupon,
    ).toHaveBeenCalledWith(['f-1', 'f-2']);
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

describe('CouponService.generateCouponWindow — safe value coupon', () => {
  it('creates a SAFE coupon with tier SAFE when safe pool is non-empty', async () => {
    const safeBets = [
      makeEligibleBet('sv-1', 'f-1', '0.000'),
      makeEligibleBet('sv-2', 'f-2', '0.000'),
      makeEligibleBet('sv-3', 'f-3', '0.000'),
    ];

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue([
          { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          { id: 'f-2', externalId: 2, scheduledAt: TEST_KICKOFF },
          { id: 'f-3', externalId: 3, scheduledAt: TEST_KICKOFF },
        ]),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi
          .fn()
          .mockResolvedValue([makeEligibleBet('ev-1', 'f-1', '0.250')]),
        findEligibleSafeValueBetsForCoupon: vi.fn().mockResolvedValue(safeBets),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    // EV coupon + SAFE coupon
    expect(deps.couponRepository.createCouponAndLinkBets).toHaveBeenCalledTimes(
      2,
    );

    const calls = (
      deps.couponRepository.createCouponAndLinkBets as ReturnType<typeof vi.fn>
    ).mock.calls as [{ tier: CouponTier; betIds: string[] }][];

    const safeCall = calls.find((c) => c[0].tier === CouponTier.SAFE);
    expect(safeCall).toBeDefined();
    expect(safeCall![0].tier).toBe(CouponTier.SAFE);
  });

  it('caps SAFE coupon at SAFE_COUPON_MAX_LEGS (2) legs even when pool has more bets', async () => {
    const safeBets = [
      makeEligibleBet('sv-1', 'f-1', '0.000'),
      makeEligibleBet('sv-2', 'f-2', '0.000'),
      makeEligibleBet('sv-3', 'f-3', '0.000'),
      makeEligibleBet('sv-4', 'f-4', '0.000'),
    ];

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi
          .fn()
          .mockResolvedValue([makeEligibleBet('ev-1', 'f-1', '0.250')]),
        findEligibleSafeValueBetsForCoupon: vi.fn().mockResolvedValue(safeBets),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    const calls = (
      deps.couponRepository.createCouponAndLinkBets as ReturnType<typeof vi.fn>
    ).mock.calls as [{ tier: CouponTier; betIds: string[] }][];

    const safeCall = calls.find((c) => c[0].tier === CouponTier.SAFE);
    expect(safeCall![0].betIds).toHaveLength(2);
    expect(safeCall![0].betIds).toEqual(['sv-1', 'sv-2']);
  });

  it('does not create a SAFE coupon when safe pool is empty', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi
          .fn()
          .mockResolvedValue([makeEligibleBet('ev-1', 'f-1', '0.250')]),
        findEligibleSafeValueBetsForCoupon: vi.fn().mockResolvedValue([]),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    const calls = (
      deps.couponRepository.createCouponAndLinkBets as ReturnType<typeof vi.fn>
    ).mock.calls as [{ tier: CouponTier }][];

    const safeCall = calls.find((c) => c[0].tier === CouponTier.SAFE);
    expect(safeCall).toBeUndefined();
    // Only the EV coupon was created
    expect(deps.couponRepository.createCouponAndLinkBets).toHaveBeenCalledTimes(
      1,
    );
  });

  it('sends a sendDailyCoupon notification for the SAFE coupon', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([
            { id: 'f-1', externalId: 1, scheduledAt: TEST_KICKOFF },
          ]),
      },
      couponRepository: {
        findEligibleBetsForCoupon: vi
          .fn()
          .mockResolvedValue([makeEligibleBet('ev-1', 'f-1', '0.250')]),
        findEligibleSafeValueBetsForCoupon: vi
          .fn()
          .mockResolvedValue([
            makeEligibleBet('sv-1', 'f-1', '0.000'),
            makeEligibleBet('sv-2', 'f-2', '0.000'),
          ]),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    // One notification per coupon: EV + SAFE
    expect(deps.notificationService.sendDailyCoupon).toHaveBeenCalledTimes(2);
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

    expect(result?.selections[0]).toMatchObject({
      probEstimated: '41.2%',
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
