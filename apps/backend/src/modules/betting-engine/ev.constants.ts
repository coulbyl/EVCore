import Decimal from 'decimal.js';

export const FEATURE_WEIGHTS = {
  recentForm: new Decimal('0.30'),
  xg: new Decimal('0.30'),
  domExtPerf: new Decimal('0.25'),
  leagueVolat: new Decimal('0.15'),
} as const;

export const EV_THRESHOLD = new Decimal('0.08');
export const MODEL_SCORE_THRESHOLD = new Decimal('0.60');

// Flat stake used when KELLY_ENABLED=false (default — safe fallback)
export const DEFAULT_STAKE_PCT = new Decimal('0.01');

// Fractional Kelly staking — enabled via KELLY_ENABLED=true config flag.
// Quarter Kelly (0.25) reduces variance significantly vs full Kelly.
// Hard cap at 5% per bet regardless of computed Kelly size.
export const KELLY_FRACTION = new Decimal('0.25');
export const KELLY_MAX_STAKE_PCT = new Decimal('0.05');

// Combo odds pricing uses the raw product as a base, then applies a damped
// correlation correction from model joint probability.
export const COMBO_CORRELATION_ALPHA = new Decimal('0.75');
export const COMBO_CORRELATION_MIN_FACTOR = new Decimal('0.50');
export const COMBO_CORRELATION_MAX_FACTOR = new Decimal('1.25');
