import Decimal from 'decimal.js';

export const FEATURE_WEIGHTS = {
  recentForm: new Decimal('0.30'),
  xg: new Decimal('0.30'),
  domExtPerf: new Decimal('0.25'),
  leagueVolat: new Decimal('0.15'),
} as const;

export const EV_THRESHOLD = new Decimal('0.08');
export const MODEL_SCORE_THRESHOLD = new Decimal('0.60');
export const ONE_X_TWO_AWAY_MAX_ODDS = new Decimal('5.0');
export const ONE_X_TWO_DRAW_MAX_ODDS = new Decimal('6.0');

// Odds window for selectable picks. Picks outside [MIN, MAX] are rejected
// regardless of EV. The lower bound eliminates over-confident short-priced
// favorites (historically negative ROI at <1.80); the upper bound eliminates
// long shots where probability overestimation inflates EV artificially.
export const MIN_SELECTION_ODDS = new Decimal('1.80');
export const MAX_SELECTION_ODDS = new Decimal('4.0');

// Home advantage correction applied to Poisson lambdas before probability
// computation. Home teams score ~12% more, away teams ~12% less than their
// season xG average — consistent with published football Poisson literature.
// Symmetric: HOME_ADVANTAGE_LAMBDA_FACTOR × AWAY_DISADVANTAGE_LAMBDA_FACTOR ≈ 1.
export const HOME_ADVANTAGE_LAMBDA_FACTOR = 1.12;
export const AWAY_DISADVANTAGE_LAMBDA_FACTOR = 0.88;
export const ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR = new Decimal('0.12');
export const ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR = new Decimal('0.20');
export const ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT = 2;

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
