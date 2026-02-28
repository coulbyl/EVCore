import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
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
