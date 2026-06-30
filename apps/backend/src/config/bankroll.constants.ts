import Decimal from 'decimal.js';

export const BANKROLL_LIMITS = {
  MAX_DEPOSIT: new Decimal(2_000_000),
  MAX_BET_WIN: new Decimal(10_000_000),
} as const;

/** Plafonds du slip — protègent les colonnes Decimal(12,2) et les calculs PnL. */
export const SLIP_LIMITS = {
  /** Mise unitaire maximale par sélection (XOF). */
  MAX_UNIT_STAKE: 500_000,
  /** Nombre maximal de sélections par coupon. */
  MAX_ITEMS: 10,
  /** Gain potentiel total maximal par coupon (XOF). */
  MAX_POTENTIAL_RETURN: 5_000_000,
} as const;
