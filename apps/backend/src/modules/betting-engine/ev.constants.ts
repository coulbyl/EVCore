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

// Per-league minimum selection odds. Each league has a different bookmaker
// efficiency profile — the optimal floor varies based on lambda (goal rate variance)
// and historical false-EV patterns on short-priced favorites.
//
// Derivation (backtest 2026-04-03, α=0.70):
//   LL  <2.0 → +17.7% ROI (low lambda 1.298, tactique, stable)  → floor 1.80
//   SA  <2.0 → insufficient data, low lambda 1.247 similar to LL → floor 1.80
//   PL  <2.0 → -32.0% ROI                                        → floor 2.00
//   BL1 <2.0 → -36.9% ROI (high lambda 1.574, high variance)     → floor 2.00
//   L1  <2.0 → insufficient data, moderate lambda 1.431           → floor 2.00
//   SP2 <2.0 → insufficient data                                  → floor 2.00
//   CH  <2.0 → -17.3%, and 2.0-2.99 HOME → -23.4%               → floor 2.10
//
// Default fallback for unmapped competitions.
const LEAGUE_MIN_SELECTION_ODDS_DEFAULT = new Decimal('2.00');

const LEAGUE_MIN_SELECTION_ODDS_MAP: Record<string, Decimal> = {
  LL: new Decimal('1.80'),
  SA: new Decimal('1.80'),
  PL: new Decimal('2.00'),
  BL1: new Decimal('2.00'),
  L1: new Decimal('2.00'),
  SP2: new Decimal('2.00'),
  CH: new Decimal('2.10'),
  // FRI uses de-vigged Pinnacle as probability source — the EV is relative to a
  // second bookmaker (Bet365). A Pinnacle-implied 65% home at 1.95 Bet365 is
  // genuine EV. The Poisson-based floor (2.00) does not apply here.
  FRI: new Decimal('1.40'),
};

export function getLeagueMinSelectionOdds(
  competitionCode: string | null | undefined,
): Decimal {
  if (
    competitionCode != null &&
    competitionCode in LEAGUE_MIN_SELECTION_ODDS_MAP
  ) {
    return LEAGUE_MIN_SELECTION_ODDS_MAP[competitionCode];
  }
  return LEAGUE_MIN_SELECTION_ODDS_DEFAULT;
}

export function getPickMinSelectionOdds(
  competitionCode: string | null | undefined,
  market: string,
  pick: string,
): Decimal {
  const leagueFloor = getLeagueMinSelectionOdds(competitionCode);

  // Championship 1X2 HOME picks in the 2.0-2.99 range were structurally
  // unprofitable in the 2026-04-03 backtest (-23.4% ROI on 25 bets) despite
  // strong simulated EV. Raise the floor to keep only higher-priced spots.
  if (competitionCode === 'CH' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  // Bundesliga 1X2 HOME picks remained structurally unprofitable across floor
  // sweeps at 2.10 / 2.25 / 2.40. The toxic segment is specifically HOME in the
  // 2.0-2.99 bucket, so keep the league floor broad and harden only this pick.
  if (competitionCode === 'BL1' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  return leagueFloor;
}

// Global floor — kept as a hard minimum across all leagues.
// The upper bound eliminates long shots where probability overestimation inflates EV.
export const MIN_SELECTION_ODDS = LEAGUE_MIN_SELECTION_ODDS_DEFAULT;
export const MAX_SELECTION_ODDS = new Decimal('4.0');

// Bayesian shrinkage — pulls raw Poisson lambdas toward the per-league mean goal rate.
// Formula: rawLambda = α × (xgFor × xgAgainst / leagueAvg) + (1 - α) × anchor
// where anchor = LEAGUE_MEAN_LAMBDA_MAP[code] ?? LEAGUE_MEAN_LAMBDA_DEFAULT.
// α = 0.70 keeps 70% of the team-specific signal and moderates extreme products.
// Computed from DB team_stats (April 2026, 7 leagues, includeInBacktest = true).
export const LAMBDA_SHRINKAGE_FACTOR = 0.7;

const LEAGUE_MEAN_LAMBDA_MAP: Record<string, number> = {
  BL1: 1.574,
  CH: 1.263,
  L1: 1.431,
  LL: 1.298,
  PL: 1.468,
  SA: 1.247,
  SP2: 1.449,
};

const LEAGUE_MEAN_LAMBDA_DEFAULT = 1.4;

export function getLeagueMeanLambda(
  competitionCode: string | null | undefined,
): number {
  if (competitionCode != null && competitionCode in LEAGUE_MEAN_LAMBDA_MAP) {
    return LEAGUE_MEAN_LAMBDA_MAP[competitionCode];
  }
  return LEAGUE_MEAN_LAMBDA_DEFAULT;
}

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
