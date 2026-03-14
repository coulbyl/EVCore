import { Prisma } from '@evcore/db';
import Decimal from 'decimal.js';

export function toPrismaDecimal(
  value: Decimal,
  decimals: number,
): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(decimals));
}

/**
 * Converts a Prisma Decimal, number, or string to a plain JS number.
 * Returns 0 for null / undefined / unrecognised shapes.
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const maybeDecimal = value as { toNumber?: () => number };
    if (typeof maybeDecimal.toNumber === 'function')
      return maybeDecimal.toNumber();
  }
  return 0;
}
