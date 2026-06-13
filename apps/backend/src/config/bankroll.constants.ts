import Decimal from 'decimal.js';

export const BANKROLL_LIMITS = {
  MAX_DEPOSIT: new Decimal(2_000_000),
  MAX_BET_WIN: new Decimal(10_000_000),
} as const;
