import { BadRequestException, Injectable } from '@nestjs/common';
import { CouponService } from '@modules/coupon/coupon.service';
import {
  ProductWeekService,
  type ProductWeek,
} from '@modules/coupon/product-day/product-week.service';
import { previousIsoWeek } from '@utils/date.utils';

const DAY_MS = 24 * 60 * 60 * 1000;

/** « Ta semaine » (08 § 3): the products' week and the player's followed coupons. */
export type WeekScreen = ProductWeek & {
  /** Followed coupons whose last match was played that week. */
  followed: { won: number; lost: number; refunded: number };
};

/**
 * GET /results/week: the sheet behind « Ta semaine », the same count as
 * the Monday statement (ProductWeekService).
 */
@Injectable()
export class WeekService {
  constructor(
    private readonly productWeek: ProductWeekService,
    private readonly coupons: CouponService,
  ) {}

  async getWeek(
    input: { userId: string; week?: string },
    now: Date = new Date(),
  ): Promise<WeekScreen> {
    const monday = input.week ?? previousIsoWeek(now);
    const from = new Date(`${monday}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || from.getUTCDay() !== 1) {
      throw new BadRequestException('La semaine commence un lundi');
    }
    const [week, followed] = await Promise.all([
      this.productWeek.getWeek(monday),
      this.coupons.getFollowedSummary(input.userId, {
        from,
        to: new Date(from.getTime() + 7 * DAY_MS),
      }),
    ]);
    return {
      ...week,
      followed: {
        won: followed.won,
        lost: followed.lost,
        refunded: followed.refunded,
      },
    };
  }
}
