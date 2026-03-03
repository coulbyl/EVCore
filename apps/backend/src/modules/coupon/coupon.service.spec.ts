import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { CouponStatus } from '@evcore/db';
import { CouponService } from './coupon.service';
import type { CouponRepository } from './coupon.repository';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { FixtureService } from '@modules/fixture/fixture.service';
import type { NotificationService } from '@modules/notification/notification.service';
import type { PrismaService } from '@/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

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
    findByDate: vi.fn().mockResolvedValue(null),
    findPendingCouponsUntil: vi.fn().mockResolvedValue([]),
    findCouponById: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 'coupon-id' }),
    linkBets: vi.fn().mockResolvedValue(undefined),
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
      betId: null,
      qualityScore: null,
    }),
    ...overrides.bettingEngineService,
  } as unknown as BettingEngineService;

  const fixtureService: FixtureService = {
    findScheduledForDate: vi.fn().mockResolvedValue([]),
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

describe('CouponService.generateDailyCoupon', () => {
  it('creates a NO_BET coupon when no fixtures are scheduled', async () => {
    const deps = makeDeps({
      fixtureService: { findScheduledForDate: vi.fn().mockResolvedValue([]) },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.couponRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: CouponStatus.NO_BET, legCount: 0 }),
    );
    expect(deps.notificationService.sendNoBetToday).toHaveBeenCalledWith(
      TEST_DATE,
    );
    expect(deps.couponRepository.linkBets).not.toHaveBeenCalled();
  });

  it('creates a NO_BET coupon when no picks pass EV threshold', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([{ id: 'f-1', externalId: 1 }]),
      },
      // analyzeFixture returns NO_BET → no bet created → bet query returns []
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.couponRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: CouponStatus.NO_BET }),
    );
    expect(deps.notificationService.sendNoBetToday).toHaveBeenCalled();
  });

  it('creates a PENDING coupon when viable picks exist', async () => {
    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi
          .fn()
          .mockResolvedValue([{ id: 'f-1', externalId: 1 }]),
      },
      prisma: {
        client: {
          bet: {
            findMany: vi
              .fn()
              // First call: collect bets for coupon selection
              .mockResolvedValueOnce([
                {
                  id: 'bet-1',
                  ev: new Decimal('0.12'),
                  modelRun: {
                    deterministicScore: new Decimal('0.70'),
                    fixtureId: 'f-1',
                  },
                },
              ])
              // Second call: fetch full bets for notification
              .mockResolvedValueOnce([
                { id: 'bet-1', market: 'ONE_X_TWO', pick: 'HOME' },
              ]),
          },
        },
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.couponRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: CouponStatus.PENDING, legCount: 1 }),
    );
    expect(deps.couponRepository.linkBets).toHaveBeenCalledWith('coupon-id', [
      'bet-1',
    ]);
    expect(deps.notificationService.sendDailyCoupon).toHaveBeenCalled();
  });

  it('respects COUPON_MAX_LEGS (caps at 6 picks)', async () => {
    // 8 fixtures with bets → only 6 should be selected
    const fixtures = Array.from({ length: 8 }, (_, i) => ({
      id: `f-${i}`,
      externalId: i + 1,
    }));
    const bets = fixtures.map((f, i) => ({
      id: `bet-${i}`,
      ev: new Decimal((0.1 + i * 0.01).toFixed(4)),
      modelRun: {
        deterministicScore: new Decimal('0.70'),
        fixtureId: f.id,
      },
    }));

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(fixtures),
      },
      prisma: {
        client: {
          bet: {
            findMany: vi
              .fn()
              .mockResolvedValueOnce(bets)
              .mockResolvedValueOnce(bets.slice(-6)),
          },
        },
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.couponRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: CouponStatus.PENDING, legCount: 6 }),
    );
  });

  it('sorts picks by qualityScore DESC', async () => {
    const fixtures = [
      { id: 'f-a', externalId: 1 },
      { id: 'f-b', externalId: 2 },
    ];
    // f-b has higher qualityScore than f-a
    const bets = [
      {
        id: 'bet-a',
        ev: new Decimal('0.10'),
        modelRun: { deterministicScore: new Decimal('0.60'), fixtureId: 'f-a' },
      },
      {
        id: 'bet-b',
        ev: new Decimal('0.20'),
        modelRun: { deterministicScore: new Decimal('0.80'), fixtureId: 'f-b' },
      },
    ];

    const deps = makeDeps({
      fixtureService: {
        findScheduledForDate: vi.fn().mockResolvedValue(fixtures),
      },
      prisma: {
        client: {
          bet: {
            findMany: vi
              .fn()
              .mockResolvedValueOnce(bets)
              .mockResolvedValueOnce([bets[1], bets[0]]),
          },
        },
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    // linkBets should have bet-b first (higher qualityScore)
    const [, linkedBets] = (
      deps.couponRepository.linkBets as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [string, string[]];
    expect(linkedBets[0]).toBe('bet-b');
    expect(linkedBets[1]).toBe('bet-a');
  });

  it('is idempotent — does not generate a second coupon for the same date', async () => {
    const deps = makeDeps({
      couponRepository: {
        findByDate: vi.fn().mockResolvedValue({
          id: 'existing-coupon',
          status: CouponStatus.PENDING,
        }),
      },
    });
    const service = makeService(deps);

    await service.generateDailyCoupon(TEST_DATE);

    expect(deps.couponRepository.create).not.toHaveBeenCalled();
    expect(deps.fixtureService.findScheduledForDate).not.toHaveBeenCalled();
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
