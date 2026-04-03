import Decimal from 'decimal.js';

export const FEATURE_WEIGHTS = {
  recentForm: new Decimal('0.30'),
  xg: new Decimal('0.30'),
  domExtPerf: new Decimal('0.25'),
  leagueVolat: new Decimal('0.15'),
} as const;

export const EV_THRESHOLD = new Decimal('0.08');

// EV soft alert — log a warning when the selected pick EV exceeds this value.
// High EV against an efficient bookmaker (Pinnacle) often signals a calibration
// anomaly (biased λ, xG proxy error) rather than a genuine edge.
export const EV_MAX_SOFT_ALERT = new Decimal('0.60');

// EV hard cap — reject any pick with EV above this value.
// An EV > 0.90 is implausible against a sharp market (Pinnacle) and
// invariably reflects a lambda or xG estimation error (audit 2026-03-22:
// Burgos EV=0.942 lost 4-0, confirming the anomaly signal).
export const EV_HARD_CAP = new Decimal('0.90');

// Minimum directional probability for 1X2 HOME and AWAY picks.
// Prevents selecting V1 when P(home win) < threshold and V2 when
// P(away win) < threshold — avoids backing the team the model itself
// considers unlikely to win (e.g. Guingamp V1 at P=36%).
export const MIN_PICK_DIRECTION_PROBABILITY = new Decimal('0.45');

// Minimum directional probability for DRAW-based combo picks (e.g. NUL + MOINS 2.5).
// Combos with DRAW as primary leg repeatedly cleared the EV floor only via high
// combo odds while P(draw) was 19-27% — audit 2026-03-21/28 showed 0/3 win rate.
// Raises the bar without disabling the market: the learning loop will adjust further
// once 50 settled bets are available per market.
export const MIN_DRAW_DIRECTION_PROBABILITY = new Decimal('0.28');

// Minimum quality score (EV × deterministicScore × longshotPenalty) required
// for a pick to be selected, given that the fixture already passed
// MODEL_SCORE_THRESHOLD. Eliminates low-EV picks that barely clear the EV
// floor with a high score, while keeping high-EV picks from fixtures just above
// the score threshold. At score=0.60, requires EV >= 0.10 to pass.
export const MIN_QUALITY_SCORE = new Decimal('0.06');
export const ONE_X_TWO_AWAY_MAX_ODDS = new Decimal('5.0');
export const ONE_X_TWO_DRAW_MAX_ODDS = new Decimal('6.0');

// Odds window for selectable picks. Picks outside [MIN, MAX] are rejected
// regardless of EV. The lower bound allows short-priced picks with genuine EV
// (audit 2026-03-22: Roma V1 at 1.52 blocked, would have won); EV and quality
// filters downstream still prevent weak short-priced selections.
// The upper bound eliminates long shots where probability overestimation inflates EV.
export const MIN_SELECTION_ODDS = new Decimal('1.45');
export const MAX_SELECTION_ODDS = new Decimal('4.0');

// Home advantage correction applied to Poisson lambdas before probability
// computation. Academic literature (Dixon-Coles, Karlis-Ntzoufras) measures
// home advantage at 5-8%. Raised from 0.93→0.95 after audit 2026-03-22
// revealed systematic away-team λ underestimation (Hertha 1.11→5, Alaves
// 0.76→4, Kiel 0.98→3 across 3 independent fixtures).
// Symmetric: HOME_ADVANTAGE_LAMBDA_FACTOR × AWAY_DISADVANTAGE_LAMBDA_FACTOR ≈ 1.
export const HOME_ADVANTAGE_LAMBDA_FACTOR = 1.05;
export const AWAY_DISADVANTAGE_LAMBDA_FACTOR = 0.95;

// MODEL_SCORE_THRESHOLD — minimum deterministic score required for a BET
// decision. Differentiated by market efficiency tier (audit finding: the flat
// 0.60 threshold blocked 7 winning picks on secondary-market fixtures).
//
// Tier A — efficient markets (well-calibrated bookmakers, high liquidity):
const MODEL_SCORE_THRESHOLD_A = new Decimal('0.55');
// Tier B — secondary markets (noisier, lower liquidity, more EV available):
const MODEL_SCORE_THRESHOLD_B = new Decimal('0.45');
// Default fallback for unmapped competition codes:
const MODEL_SCORE_THRESHOLD_DEFAULT = new Decimal('0.60');

const MODEL_SCORE_THRESHOLD_MAP: Record<string, Decimal> = {
  // Tier A — efficient markets
  PL: MODEL_SCORE_THRESHOLD_A,
  SA: MODEL_SCORE_THRESHOLD_A,
  BL1: MODEL_SCORE_THRESHOLD_A,
  LL: MODEL_SCORE_THRESHOLD_A,
  L1: MODEL_SCORE_THRESHOLD_A,
  // Tier B — secondary / lower-division markets
  CH: MODEL_SCORE_THRESHOLD_B,
  D2: MODEL_SCORE_THRESHOLD_B,
  F2: MODEL_SCORE_THRESHOLD_B,
  SP2: MODEL_SCORE_THRESHOLD_A,
  I2: MODEL_SCORE_THRESHOLD_B,
  EL1: MODEL_SCORE_THRESHOLD_B,
  EL2: MODEL_SCORE_THRESHOLD_B,
  // Tier C — European competitions (decided in prior session)
  LDC: MODEL_SCORE_THRESHOLD_B,
  UEL: MODEL_SCORE_THRESHOLD_B,
  UECL: MODEL_SCORE_THRESHOLD_B,
  // Tier D — international competitions (conservative default — limited team
  // data, high variance, no historical backtest baseline yet).
  WCQE: MODEL_SCORE_THRESHOLD_DEFAULT,
  FRI: new Decimal('0.45'),
  UNL: MODEL_SCORE_THRESHOLD_DEFAULT,
  CAN: MODEL_SCORE_THRESHOLD_DEFAULT,
  COPA: MODEL_SCORE_THRESHOLD_DEFAULT,
};

export function getModelScoreThreshold(
  competitionCode: string | null,
): Decimal {
  if (
    competitionCode !== null &&
    competitionCode in MODEL_SCORE_THRESHOLD_MAP
  ) {
    return MODEL_SCORE_THRESHOLD_MAP[competitionCode];
  }
  return MODEL_SCORE_THRESHOLD_DEFAULT;
}

// Kept for backward-compatibility with existing tests that import this name.
// Points to the default (unmapped) threshold — prefer getModelScoreThreshold()
// in production code.
export const MODEL_SCORE_THRESHOLD = MODEL_SCORE_THRESHOLD_DEFAULT;

// Per-league EV threshold overrides.
// Leagues with sparse xG data or thin odds coverage require a stronger signal
// before a BET decision is made. Leagues not in this map use EV_THRESHOLD (0.08).
// Audit 2026-03-20/28: FRI (4% xG coverage) → 0/1, WCQE → 0/4, EL2/F2 → 0/8.
const LEAGUE_EV_THRESHOLD_MAP: Record<string, Decimal> = {
  // Tier D international — sparse xG (FRI 4%, WCQE ~9% zero-xG records)
  WCQE: new Decimal('0.15'),
  FRI: new Decimal('0.15'),
  UNL: new Decimal('0.12'),
  // Lower divisions — sparser odds coverage, higher xG noise
  EL2: new Decimal('0.10'),
  F2: new Decimal('0.10'),
};

export function getLeagueEvThreshold(competitionCode: string | null): Decimal {
  if (competitionCode !== null && competitionCode in LEAGUE_EV_THRESHOLD_MAP) {
    return LEAGUE_EV_THRESHOLD_MAP[competitionCode];
  }
  return EV_THRESHOLD;
}
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
