import { describe, it, expect, vi } from 'vitest';
import { CouponController } from './coupon.controller';
import type { CouponService } from './coupon.service';

describe('CouponController', () => {
  it('delegates settle endpoint to service with coupon id', async () => {
    const settleCouponById = vi.fn().mockResolvedValue({
      couponId: 'coupon-1',
      status: 'WON',
      settled: true,
    });
    const service = { settleCouponById } as unknown as CouponService;
    const controller = new CouponController(service);

    await expect(controller.settleCoupon('coupon-1')).resolves.toEqual({
      couponId: 'coupon-1',
      status: 'WON',
      settled: true,
    });
    expect(settleCouponById).toHaveBeenCalledWith('coupon-1');
  });
});
