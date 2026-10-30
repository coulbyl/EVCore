import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { CouponService } from '@modules/coupon/coupon.service';
import type { ProductWeekService } from '@modules/coupon/product-day/product-week.service';
import { WeekService } from './week.service';

function harness() {
  const productWeek = {
    getWeek: vi
      .fn()
      .mockResolvedValue({ week: '2026-10-19', days: [], products: [] }),
  } as unknown as ProductWeekService;
  const coupons = {
    getFollowedSummary: vi
      .fn()
      .mockResolvedValue({ won: 2, lost: 1, refunded: 0, since: '2026-10-13' }),
  } as unknown as CouponService;
  return {
    service: new WeekService(productWeek, coupons),
    productWeek,
    coupons,
  };
}

describe('WeekService', () => {
  it('the last closed week by default, with the followed coupons of that week', async () => {
    const { service, productWeek, coupons } = harness();
    const week = await service.getWeek(
      { userId: 'u1' },
      new Date('2026-10-30T12:00:00.000Z'),
    );
    expect(productWeek.getWeek).toHaveBeenCalledWith('2026-10-19');
    expect(coupons.getFollowedSummary).toHaveBeenCalledWith('u1', {
      from: new Date('2026-10-19T00:00:00.000Z'),
      to: new Date('2026-10-26T00:00:00.000Z'),
    });
    expect(week.followed).toEqual({ won: 2, lost: 1, refunded: 0 });
  });

  it('a week starts on a Monday', async () => {
    const { service } = harness();
    await expect(
      service.getWeek({ userId: 'u1', week: '2026-10-21' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
