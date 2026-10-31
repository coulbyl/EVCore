import { Prisma } from '@evcore/db';
import { couponChanceOf, paidOddsOf } from './coupon-chance';
import type { ProductDayRow, ProductLegRow } from './product-day.repository';

type ProductRef = { key: string; source: string; targetOddsMin: number };

/**
 * The products' days from their coupons' legs (one coupon per product and
 * day, as ProductDayRepository.findProductLegs chose it), reduced to what
 * « Résultats » counts, in decimal.js.
 */
export function productDaysOf(
  rows: readonly ProductLegRow[],
  products: readonly ProductRef[],
): ProductDayRow[] {
  const byCoupon = new Map<string, ProductLegRow[]>();
  for (const row of rows) {
    const legs = byCoupon.get(row.couponId) ?? [];
    legs.push(row);
    byCoupon.set(row.couponId, legs);
  }
  return [...byCoupon.values()].flatMap((legs) => {
    const [first] = legs;
    const product = first
      ? products.find(
          (p) =>
            p.source === first.source &&
            p.targetOddsMin === Number(first.targetOddsMin),
        )
      : undefined;
    return first && product ? [dayOf(product.key, legs, first)] : [];
  });
}

function outcomeOf(result: ProductLegRow['result']): ProductDayRow['outcome'] {
  if (result === 'WON' || result === 'PARTIAL') return 'won';
  if (result === 'LOST') return 'lost';
  if (result === 'VOID') return 'refunded';
  return 'pending';
}

function dayOf(
  product: string,
  legs: readonly ProductLegRow[],
  first: ProductLegRow,
): ProductDayRow {
  const outcome = outcomeOf(first.result);
  const single = legs.length === 1;
  const chance = couponChanceOf(legs);
  const paid = outcome === 'won' ? paidOddsOf(legs) : null;
  return {
    product,
    forDate: first.forDate,
    couponProposalId: first.couponId,
    outcome,
    // Stored as the column reads them back.
    chance: chance === null ? null : new Prisma.Decimal(chance),
    paidOdds:
      paid === null
        ? null
        : new Prisma.Decimal(paid.toDecimalPlaces(3).toString()),
    priced: legs.every((leg) => leg.operatorOdds !== null),
    label: single
      ? `${first.homeName} – ${first.awayName}`
      : `${legs.length} matchs`,
    market: single ? first.market : null,
    pick: single ? first.pick : null,
  };
}
