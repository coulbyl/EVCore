import Decimal from 'decimal.js';

// Accepts Prisma.Decimal too: Prisma vendors its own decimal.js copy, so a
// cross-instance `new Decimal(prismaDecimal)` throws — round-trip via string
// instead (lossless for decimals).
export type DecimalLike = Decimal.Value | { toString(): string };

export function toDecimal(value: DecimalLike): Decimal {
  return new Decimal(typeof value === 'number' ? value : value.toString());
}

// Single rounding helper for every number EVA returns (odds, probabilities,
// ROI, edge) — decimal.js per the arithmetic rules, 4 decimal places.
export function round(value: DecimalLike): number {
  return toDecimal(value).toDecimalPlaces(4).toNumber();
}

export function sumDecimals(
  values: Array<DecimalLike | null | undefined>,
): Decimal {
  return values.reduce<Decimal>(
    (sum, value) => (value == null ? sum : sum.plus(toDecimal(value))),
    new Decimal(0),
  );
}

// ROI of settled picks at 1 unit staked per bet: (Σ winning odds - n) / n.
export function settledRoi(
  totalWonOdds: Decimal,
  settledCount: number,
): number | null {
  if (settledCount === 0) return null;
  return round(totalWonOdds.minus(settledCount).div(settledCount));
}

// Calibration error of a single settled pick: |p - outcome|.
export function probError(probability: DecimalLike, won: boolean): number {
  return round(
    toDecimal(probability)
      .minus(won ? 1 : 0)
      .abs(),
  );
}
