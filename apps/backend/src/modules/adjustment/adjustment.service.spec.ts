import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { AdjustmentStatus } from '@evcore/db';
import { AdjustmentService } from './adjustment.service';
import type { PrismaService } from '@/prisma.service';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { CouponService } from '@modules/coupon/coupon.service';
import type { NotificationService } from '@modules/notification/notification.service';
import type { CalibrationService } from './calibration.service';
import { MIN_BET_COUNT } from './adjustment.constants';

const APPLIED_WEIGHTS = {
  recentForm: new Decimal('0.30'),
  xg: new Decimal('0.30'),
  domExtPerf: new Decimal('0.25'),
  leagueVolat: new Decimal('0.15'),
};

function makeService({
  settled = 3,
  calibration = null as
    | Parameters<typeof AdjustmentService.prototype.settleAndCheck>[0]
    | null,
  recentApply = null as { id: string } | null,
  createProposal = vi.fn().mockResolvedValue({ id: 'proposal-id' }),
  computeForMarket = vi.fn().mockResolvedValue(null),
  settledBets = [] as {
    status: 'WON' | 'LOST';
    modelRun: { features: Record<string, unknown> };
  }[],
} = {}) {
  const bettingEngine = {
    settleOpenBets: vi.fn().mockResolvedValue({ settled }),
    getEffectiveWeights: vi.fn().mockResolvedValue(APPLIED_WEIGHTS),
  } as unknown as BettingEngineService;

  const calibrationService = {
    computeForMarket,
  } as unknown as CalibrationService;

  const couponService = {
    settlePendingCouponsByFixture: vi
      .fn()
      .mockResolvedValue({ settledCount: 0 }),
    settleExpiredCoupons: vi.fn().mockResolvedValue({ settledCount: 0 }),
  } as unknown as CouponService;

  const notification = {
    sendWeightAdjustmentAlert: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationService;

  const prismaMock = {
    client: {
      adjustmentProposal: {
        findFirst: vi.fn().mockResolvedValue(recentApply),
        create: createProposal,
        findMany: vi.fn().mockResolvedValue([]),
        findUniqueOrThrow: vi.fn(),
      },
      bet: {
        findMany: vi.fn().mockResolvedValue(settledBets),
      },
    },
  } as unknown as PrismaService;

  void calibration; // not used directly — computeForMarket mock drives behaviour

  return new AdjustmentService(
    prismaMock,
    bettingEngine,
    couponService,
    calibrationService,
    notification,
  );
}

describe('AdjustmentService.settleAndCheck', () => {
  it('returns settled count and no proposal when calibration is null (not enough bets)', async () => {
    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue(null),
    });
    const result = await service.settleAndCheck('fixture-id');

    expect(result.settled).toBe(3);
    expect(result.proposalId).toBeNull();
    expect(result.calibration).toBeNull();
    expect(result.shadowProposalId).toBeNull();
  });

  it('returns no proposal when needsAdjustment=false', async () => {
    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue({
        brierScore: new Decimal('0.20'),
        meanError: new Decimal('0.05'),
        betCount: MIN_BET_COUNT,
        needsAdjustment: false,
      }),
    });
    const result = await service.settleAndCheck('fixture-id');

    expect(result.proposalId).toBeNull();
  });

  it('returns no proposal when betCount is below minimum', async () => {
    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue({
        brierScore: new Decimal('0.30'),
        meanError: new Decimal('0.10'),
        betCount: MIN_BET_COUNT - 1,
        needsAdjustment: true,
      }),
    });
    const result = await service.settleAndCheck('fixture-id');

    expect(result.proposalId).toBeNull();
  });

  it('returns no proposal when a recent apply already exists', async () => {
    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue({
        brierScore: new Decimal('0.30'),
        meanError: new Decimal('0.10'),
        betCount: MIN_BET_COUNT,
        needsAdjustment: true,
      }),
      recentApply: { id: 'recent-proposal-id' },
    });
    const result = await service.settleAndCheck('fixture-id');

    expect(result.proposalId).toBeNull();
  });

  it('auto-applies and returns proposalId when calibration triggers', async () => {
    const createProposal = vi.fn().mockResolvedValue({ id: 'new-proposal-id' });
    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue({
        brierScore: new Decimal('0.325'),
        meanError: new Decimal('0.15'),
        betCount: MIN_BET_COUNT,
        needsAdjustment: true,
      }),
      recentApply: null,
      createProposal,
    });

    const result = await service.settleAndCheck('fixture-id');

    expect(result.proposalId).toBe('new-proposal-id');
    expect(createProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdjustmentStatus.APPLIED,
        }),
      }),
    );
  });
});

describe('AdjustmentService.rollback', () => {
  it('creates a new APPLIED proposal with reversed weights', async () => {
    const createProposal = vi
      .fn()
      .mockResolvedValue({ id: 'rollback-proposal-id' });
    const prismaMock = {
      client: {
        adjustmentProposal: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'original-id',
            currentWeights: {
              recentForm: '0.300000',
              xg: '0.300000',
              domExtPerf: '0.250000',
              leagueVolat: '0.150000',
            },
            proposedWeights: {
              recentForm: '0.250000',
              xg: '0.250000',
              domExtPerf: '0.300000',
              leagueVolat: '0.200000',
            },
            calibrationError: 0.325,
            triggerBetCount: 50,
          }),
          create: createProposal,
        },
      },
    } as unknown as PrismaService;

    const notification = {
      sendWeightAdjustmentAlert: vi.fn().mockResolvedValue(undefined),
    } as unknown as NotificationService;

    const service = new AdjustmentService(
      prismaMock,
      {} as BettingEngineService,
      { settleExpiredCoupons: vi.fn() } as unknown as CouponService,
      {} as CalibrationService,
      notification,
    );

    const result = await service.rollback('original-id');

    expect(result.newProposalId).toBe('rollback-proposal-id');
    expect(createProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdjustmentStatus.APPLIED,
          notes: expect.stringContaining('original-id'),
        }),
      }),
    );
  });
});

describe('computeAdjustedWeights (via settleAndCheck)', () => {
  it('reduces top weights and increases bottom weights when meanError > 0', async () => {
    let capturedProposedWeights: Record<string, string> | undefined;
    const createProposal = vi
      .fn()
      .mockImplementation(
        (args: { data: { proposedWeights: Record<string, string> } }) => {
          capturedProposedWeights = args.data.proposedWeights;
          return Promise.resolve({ id: 'p-id' });
        },
      );

    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue({
        brierScore: new Decimal('0.325'),
        meanError: new Decimal('0.05'), // positive → reduce top (recentForm=0.30 and xg=0.30), increase bottom
        betCount: MIN_BET_COUNT,
        needsAdjustment: true,
      }),
      recentApply: null,
      createProposal,
    });

    await service.settleAndCheck('fixture-id');

    expect(capturedProposedWeights).toBeDefined();
    // recentForm and xg (tied top) should be reduced; leagueVolat (bottom) increased
    const proposed = capturedProposedWeights!;
    const rf = parseFloat(proposed['recentForm']);
    const lv = parseFloat(proposed['leagueVolat']);
    expect(rf).toBeLessThan(0.3);
    expect(lv).toBeGreaterThan(0.15);
  });
});

describe('AdjustmentService shadow correlations', () => {
  it('returns no shadow correlations when settled bets are below 50', async () => {
    const settledBets = Array.from({ length: 49 }, (_, i) => ({
      status: i % 2 === 0 ? ('WON' as const) : ('LOST' as const),
      modelRun: {
        features: { shadow_h2h: i % 3, shadow_congestion: i % 4 },
      },
    }));

    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue(null),
      settledBets,
    });

    const correlations = await service.computeShadowCorrelations();
    expect(correlations).toBeNull();
  });

  it('does not auto-activate when rho is weak', async () => {
    const createProposal = vi.fn().mockResolvedValue({ id: 'proposal-id' });
    const settledBets = Array.from({ length: 60 }, (_, i) => ({
      status: i % 2 === 0 ? ('WON' as const) : ('LOST' as const),
      modelRun: {
        features: {
          shadow_h2h: 0.5,
          shadow_congestion: 0.5,
          shadow_injuries: { total: 1 },
        },
      },
    }));

    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue(null),
      createProposal,
      settledBets,
      recentApply: null,
    });

    const result = await service.settleAndCheck('fixture-id');
    expect(result.shadowCorrelations).not.toBeNull();
    expect(result.shadowProposalId).toBeNull();
    expect(createProposal).not.toHaveBeenCalled();
  });

  it('auto-activates shadow feature when |rho| > 0.15 on 50+ samples', async () => {
    const createProposal = vi
      .fn()
      .mockResolvedValue({ id: 'shadow-proposal-id' });
    const settledBets = Array.from({ length: 60 }, (_, i) => {
      const won = i < 30;
      return {
        status: won ? ('WON' as const) : ('LOST' as const),
        modelRun: {
          features: {
            shadow_h2h: won ? 1 : 0,
            shadow_congestion: won ? 0 : 1,
            shadow_injuries: { total: won ? 0 : 3 },
          },
        },
      };
    });

    const service = makeService({
      computeForMarket: vi.fn().mockResolvedValue(null),
      createProposal,
      settledBets,
      recentApply: null,
    });

    const result = await service.settleAndCheck('fixture-id');
    expect(result.shadowCorrelations).not.toBeNull();
    expect(result.shadowProposalId).toBe('shadow-proposal-id');
    expect(createProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdjustmentStatus.APPLIED,
          notes: expect.stringContaining('Shadow auto-activation'),
        }),
      }),
    );
  });
});
