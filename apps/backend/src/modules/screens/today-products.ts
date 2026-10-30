import {
  classForTargetOddsMin,
  COMBO_COUPON_CLASS,
  DOUBLE_COUPON_CLASS,
  FAVOURITE_COUPON_CLASS,
  HUNTER_BTTS_CLASS,
  HUNTER_CORNERS_CLASS,
  HUNTER_DRAW_CLASS,
  HUNTER_SCORE_CLASS,
} from '@evcore/analysis-core';
import { TODAY_PRODUCTS } from '@config/screens.constants';
import type { TodayProductKey } from './today.types';

/**
 * The target bands that identify each product in `coupon_proposal`: there is
 * no product column, the class is carried by `targetOddsMin`
 * (`classForTargetOddsMin`). The LLM combo shares COMBO's band and is told
 * apart by its source, filtered out in the queries.
 */
export const TODAY_PRODUCT_TARGETS: readonly number[] = [
  FAVOURITE_COUPON_CLASS,
  COMBO_COUPON_CLASS,
  DOUBLE_COUPON_CLASS,
  HUNTER_BTTS_CLASS,
  HUNTER_DRAW_CLASS,
  HUNTER_SCORE_CLASS,
  HUNTER_CORNERS_CLASS,
].map((couponClass) => couponClass.targetOddsMin);

const PRODUCTS: ReadonlySet<string> = new Set(TODAY_PRODUCTS);

/** True for a product of this screen (TODAY_PRODUCTS). */
export function isTodayProduct(
  name: string | null | undefined,
): name is TodayProductKey {
  return name !== null && name !== undefined && PRODUCTS.has(name);
}

/** The product of a stored proposal, or null if it is not one of this screen. */
export function productOfTarget(targetOddsMin: number): TodayProductKey | null {
  const name = classForTargetOddsMin(targetOddsMin);
  return isTodayProduct(name) ? name : null;
}

/**
 * A coupon of « Aujourd'hui », the only ones a player follows (09 § 1):
 * rank 1, a product's band, never the LLM source. Moi, its record and the
 * notifications all read the same coupons.
 */
export function isTodayCoupon(coupon: {
  source: string;
  rank: number;
  targetOddsMin: number;
}): boolean {
  return (
    coupon.source !== 'LLM' &&
    coupon.rank === 1 &&
    productOfTarget(coupon.targetOddsMin) !== null
  );
}

/** Screen order (TODAY_PRODUCTS), for sorting. */
export function productRank(product: TodayProductKey): number {
  return TODAY_PRODUCTS.indexOf(product);
}
