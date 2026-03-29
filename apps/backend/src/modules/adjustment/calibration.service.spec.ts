import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BetStatus, Market } from '@evcore/db';
import { CalibrationService } from './calibration.service';
import type { PrismaService } from '@/prisma.service';

// Bet 1: prob=0.6, WON  → brierContrib=(0.6-1)^2=0.16, error=0.6-1=-0.4
// Bet 2: prob=0.7, LOST → brierContrib=(0.7-0)^2=0.49, error=0.7-0=0.7
// brierScore = (0.16+0.49)/2 = 0.325
// meanError  = (-0.4+0.7)/2  = 0.15

describe('CalibrationService.compute', () => {
  const service = new CalibrationService({} as PrismaService);

  it('computes brierScore correctly for known inputs', () => {
    const result = service.compute([
      { probEstimated: new Decimal('0.6'), outcome: 1 },
      { probEstimated: new Decimal('0.7'), outcome: 0 },
    ]);

    expect(result.brierScore.toDecimalPlaces(4).toNumber()).toBeCloseTo(
      0.325,
      4,
    );
  });

  it('computes meanError correctly', () => {
    const result = service.compute([
      { probEstimated: new Decimal('0.6'), outcome: 1 },
      { probEstimated: new Decimal('0.7'), outcome: 0 },
    ]);

    expect(result.meanError.toDecimalPlaces(4).toNumber()).toBeCloseTo(0.15, 4);
  });

  it('sets needsAdjustment=true when brierScore > 0.25', () => {
    const result = service.compute([
      { probEstimated: new Decimal('0.6'), outcome: 1 },
      { probEstimated: new Decimal('0.7'), outcome: 0 },
    ]);

    expect(result.needsAdjustment).toBe(true);
  });

  it('sets needsAdjustment=false when brierScore <= 0.25', () => {
    // Perfect prediction: prob=1 WON, prob=0 LOST → brierScore = 0
    const result = service.compute([
      { probEstimated: new Decimal('1'), outcome: 1 },
      { probEstimated: new Decimal('0'), outcome: 0 },
    ]);

    expect(result.needsAdjustment).toBe(false);
  });

  it('returns zero metrics for empty input', () => {
    const result = service.compute([]);

    expect(result.brierScore.toNumber()).toBe(0);
    expect(result.meanError.toNumber()).toBe(0);
    expect(result.betCount).toBe(0);
    expect(result.needsAdjustment).toBe(false);
  });

  it('returns correct betCount', () => {
    const result = service.compute([
      { probEstimated: new Decimal('0.6'), outcome: 1 },
      { probEstimated: new Decimal('0.7'), outcome: 0 },
    ]);

    expect(result.betCount).toBe(2);
  });
});

describe('CalibrationService.computeAllMarkets', () => {
  it('returns null for each market when fewer than MIN_BET_COUNT bets are settled', async () => {
    const prisma = {
      client: {
        bet: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    } as unknown as PrismaService;

    const service = new CalibrationService(prisma);
    const results = await service.computeAllMarkets();

    expect(results[Market.ONE_X_TWO]).toBeNull();
    expect(results[Market.OVER_UNDER]).toBeNull();
    expect(results[Market.BTTS]).toBeNull();
  });

  it('queries each market independently', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      client: { bet: { findMany } },
    } as unknown as PrismaService;

    const service = new CalibrationService(prisma);
    await service.computeAllMarkets();

    expect(findMany).toHaveBeenCalledTimes(3);
    const calledMarkets = findMany.mock.calls.map(
      (call) => (call[0] as { where: { market: string } }).where.market,
    );
    expect(calledMarkets).toContain(Market.ONE_X_TWO);
    expect(calledMarkets).toContain(Market.OVER_UNDER);
    expect(calledMarkets).toContain(Market.BTTS);
  });
});

describe('CalibrationService.computeForMarket with excludeLambdaFloorHit', () => {
  it('includes a NOT filter when excludeLambdaFloorHit is true', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      client: { bet: { findMany } },
    } as unknown as PrismaService;

    const service = new CalibrationService(prisma);
    await service.computeForMarket(Market.ONE_X_TWO, {
      excludeLambdaFloorHit: true,
    });

    const whereClause = (findMany.mock.calls[0] as [{ where: unknown }])[0]
      .where as Record<string, unknown>;
    expect(whereClause).toHaveProperty('NOT');
  });

  it('does not include a NOT filter when excludeLambdaFloorHit is false', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      client: { bet: { findMany } },
    } as unknown as PrismaService;

    const service = new CalibrationService(prisma);
    await service.computeForMarket(Market.ONE_X_TWO, {
      excludeLambdaFloorHit: false,
    });

    const whereClause = (findMany.mock.calls[0] as [{ where: unknown }])[0]
      .where as Record<string, unknown>;
    expect(whereClause).not.toHaveProperty('NOT');
  });

  it('returns a CalibrationResult when enough bets are settled', async () => {
    const mockBets = Array.from({ length: 50 }, (_, i) => ({
      probEstimated: new Decimal('0.6'),
      status: i % 2 === 0 ? BetStatus.WON : BetStatus.LOST,
    }));
    const prisma = {
      client: { bet: { findMany: vi.fn().mockResolvedValue(mockBets) } },
    } as unknown as PrismaService;

    const service = new CalibrationService(prisma);
    const result = await service.computeForMarket(Market.ONE_X_TWO);

    expect(result).not.toBeNull();
    expect(result?.betCount).toBe(50);
  });
});
