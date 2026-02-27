import { Prisma } from '@evcore/db';
import Decimal from 'decimal.js';

export function toPrismaDecimal(
  value: Decimal,
  decimals: number,
): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(decimals));
}
