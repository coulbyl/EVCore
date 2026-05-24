/**
 * Hyperparamètres de l'investissement — outputs du backtest (2026-05-19).
 *
 * Source : apps/backend/reports/backtest-selected-params.json
 * Train ROI : +100.3% | Test ROI : +61.8% | Test hit rate : 51.5% | verdict : PASS
 *
 * NE PAS modifier manuellement — relancer le backtest et mettre à jour depuis
 * backtest-selected-params.json.
 */

export type InvestmentCanal = 'EV' | 'SV' | 'BB' | 'NUL' | 'CONF';

export const MAX_INVESTMENT_SELECTIONS: Record<InvestmentCanal, number> = {
  SV: 5,
  BB: 5,
  CONF: 5,
  NUL: 2,
  EV: 2,
} as const;

export const CANAL_BASE_WEIGHT: Record<InvestmentCanal, number> = {
  SV: 0.74,
  CONF: 0.66,
  BB: 0.62,
  EV: 0.36,
  NUL: 0.2,
} as const;

export const INVESTMENT_PARAMS = {
  k: 20,
  capMin: 0.05,
  capMax: 0.8,
  minCalibratedJointProbability: 0.25,
  maxLegs: 3,
  maxCoupons: 3,
  maxCombinedOdds: 6.0,
  recencyWeighting: 'exponential_decay_14d' as const,
  decayHalfLifeDays: 14,
  nLeagueMin: 15,
  windowDays: 38,
  includeConfInCoupons: true,
  couponMinSample: { SV: 10, BB: 10, EV: 5, CONF: 20, NUL: 20 } as Record<
    InvestmentCanal,
    number
  >,
} as const;
