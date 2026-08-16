import Decimal from 'decimal.js';

// Accepts Prisma.Decimal too: Prisma vendors its own decimal.js copy, so a
// cross-instance `new Decimal(prismaDecimal)` throws — round-trip via string
// instead (lossless for decimals).
export type DecimalLike = Decimal.Value | { toString(): string };

export function toDecimal(value: DecimalLike): Decimal {
  return new Decimal(typeof value === 'number' ? value : value.toString());
}

// Single rounding helper for odds/probabilities/ROI/edge — decimal.js per
// the arithmetic rules, 4 decimal places.
export function round(value: DecimalLike): number {
  return toDecimal(value).toDecimalPlaces(4).toNumber();
}

// Product of odds (or any decimal-like values) via decimal.js — per the
// project's arithmetic rules, never native `number` multiplication for odds.
export function productDecimal(values: DecimalLike[]): Decimal {
  return values.reduce(
    (acc: Decimal, v) => acc.mul(toDecimal(v)),
    new Decimal(1),
  );
}
