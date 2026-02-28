import Decimal from 'decimal.js';

export const FEATURE_WEIGHTS = {
  recentForm: new Decimal('0.30'),
  xg: new Decimal('0.30'),
  domExtPerf: new Decimal('0.25'),
  leagueVolat: new Decimal('0.15'),
} as const;

export const EV_THRESHOLD = new Decimal('0.08');
export const MODEL_SCORE_THRESHOLD = new Decimal('0.60');
export const DEFAULT_STAKE_PCT = new Decimal('0.01');
