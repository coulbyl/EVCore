import { describe, it, expect, vi } from 'vitest';
import { CouponDailyGenerationService } from './coupon-daily-generation.service';
import type { CouponPriceGenerationService } from './coupon-price-generation.service';
import type { CouponFavouriteGenerationService } from './coupon-favourite-generation.service';
import type { CouponDoubleGenerationService } from './coupon-double-generation.service';
import type { CouponEngineComboGenerationService } from './coupon-engine-combo-generation.service';
import type { CouponHunterGenerationService } from './coupon-hunter-generation.service';
import type { CouponPricedPoolService } from './coupon-priced-pool.service';

function makeHarness(loadFails = false) {
  const pool = {
    dayStart: new Date(),
    rows: [],
    quotes: new Map(),
    candidates: [],
  };
  const pricedPool = {
    load: loadFails
      ? vi.fn().mockRejectedValue(new Error('db down'))
      : vi.fn().mockResolvedValue(pool),
  } as unknown as CouponPricedPoolService;
  const ok = { outcome: 'abstained', reason: 'x', candidateCount: 0 };
  const double = {
    generateForDate: vi.fn().mockResolvedValue(ok),
  } as unknown as CouponDoubleGenerationService;
  const hunters = {
    generateForDate: vi.fn().mockResolvedValue([]),
  } as unknown as CouponHunterGenerationService;
  const service = new CouponDailyGenerationService(
    {
      generateForDate: vi.fn().mockResolvedValue(ok),
    } as unknown as CouponPriceGenerationService,
    {
      generateForDate: vi.fn().mockResolvedValue(ok),
    } as unknown as CouponFavouriteGenerationService,
    double,
    {
      generateForDate: vi.fn().mockResolvedValue(ok),
    } as unknown as CouponEngineComboGenerationService,
    hunters,
    pricedPool,
  );
  return { service, pricedPool, double, hunters, pool };
}

describe('CouponDailyGenerationService', () => {
  it('loads the priced pool once and hands it to the odds 2–3 coupon and the hunters', async () => {
    const { service, pricedPool, double, hunters, pool } = makeHarness();
    const day = new Date('2026-10-29');
    await service.generateForDate(day);
    expect(pricedPool.load).toHaveBeenCalledTimes(1);
    expect(double.generateForDate).toHaveBeenCalledWith(day, pool);
    expect(hunters.generateForDate).toHaveBeenCalledWith(day, pool);
  });

  it('lets each pass reload the pool when the shared load fails', async () => {
    const { service, double } = makeHarness(true);
    const day = new Date('2026-10-29');
    await service.generateForDate(day);
    expect(double.generateForDate).toHaveBeenCalledWith(day, undefined);
  });
});
