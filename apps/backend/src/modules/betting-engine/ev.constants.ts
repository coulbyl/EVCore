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

const PICK_DIRECTION_PROBABILITY_THRESHOLD_DEFAULT =
  MIN_PICK_DIRECTION_PROBABILITY;

// Keys: "${competitionCode}|${market}|${pick}"
const PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP: Record<string, Decimal> = {
  // Audit 2026-04-04: rejected D2 1X2 AWAY picks failing only the probability
  // gate were strongly profitable in backtest (+15.9% ROI on 131 picks). Relax
  // only this branch instead of lowering the global floor.
  'D2|ONE_X_TWO|AWAY': new Decimal('0.40'),
  // Audit 2026-04-04: EL1 HOME is structurally miscalibrated — model over-estimates
  // P(home win) by ~15pp. Raising the probability gate reduces exposure to the
  // over-confident sub-population where EV > 0.25 but actual ROI is -32%.
  'EL1|ONE_X_TWO|HOME': new Decimal('0.52'),
  // Audit 2026-04-04: MX1 AWAY is toxic in all observed segments (placed -31%,
  // rejected sim -24%). Both placed and rejected groups have P(away) >= 0.45 or
  // not — result is equally bad. Raising the threshold reduces volume while
  // preserving the rare high-probability AWAY that may carry real edge.
  'MX1|ONE_X_TWO|AWAY': new Decimal('0.50'),
};

export function getPickDirectionProbabilityThreshold(
  competitionCode: string | null | undefined,
  market: string,
  pick: string,
): Decimal {
  const key = `${competitionCode}|${market}|${pick}`;
  return (
    PICK_DIRECTION_PROBABILITY_THRESHOLD_MAP[key] ??
    PICK_DIRECTION_PROBABILITY_THRESHOLD_DEFAULT
  );
}

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
  J1: new Decimal('1.80'),
  MX1: new Decimal('1.90'),
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

  // PL 1X2 DRAW: profitable segment is exclusively at odds >= 5.0.
  // Audit 2026-04-04: [3.0–4.99] → 28b at −3.0% ROI (−0.83 profit);
  // [>=5.0] → 24b at +29.8% ROI (+7.15 profit). The ceiling is already raised
  // to 5.50 via getPickMaxSelectionOdds — this floor creates the [5.0, 5.50) window.
  if (competitionCode === 'PL' && market === 'ONE_X_TWO' && pick === 'DRAW') {
    return new Decimal('5.00');
  }

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

  // Audit 2026-04-04 (initial): D2 1X2 HOME picks were structurally negative in
  // the 2.0-2.99 bucket (-15.3% ROI on 32 bets). Floor raised to 2.50.
  // Audit 2026-04-04 (post-patch): remaining 7 bets had avg odds 2.72, still
  // -62.1% ROI. Pattern matches CH HOME and BL1 HOME — raise to 3.00 for parity.
  if (competitionCode === 'D2' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  // Audit 2026-04-04: CH AWAY placed was -15.9% ROI across 18 bets. The only
  // marginal positive signal was at odds >= 3.5 (N=3). Align with CH HOME (3.00)
  // and require a slight premium to avoid the negative mid-priced AWAY bucket.
  if (competitionCode === 'CH' && market === 'ONE_X_TWO' && pick === 'AWAY') {
    return Decimal.max(leagueFloor, new Decimal('3.50'));
  }

  // Audit 2026-04-04: MX1 AWAY remaining bets (after probability threshold raise
  // to 0.50) had avg odds 2.40 — same toxic mid-range. The only marginal positive
  // signal was at odds >= 3.5 (N=3, backtest-analysis 2026-04-04). Add floor to
  // require premium odds before any MX1 AWAY bet is accepted.
  if (competitionCode === 'MX1' && market === 'ONE_X_TWO' && pick === 'AWAY') {
    return Decimal.max(leagueFloor, new Decimal('3.50'));
  }

  // Audit 2026-04-04: SP2 HOME placed (odds 1.80–2.70) was -21.5% ROI on 8 bets.
  // Rejected SP2 HOME blocked by odds_below_floor showed positive sim ROI —
  // meaning the short-odds favorites (< current floor) are profitable while the
  // medium-priced ones (>= floor) are not. Lower the floor to admit favorites;
  // getPickMaxSelectionOdds() caps the upper bound to exclude the losing segment.
  if (competitionCode === 'SP2' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return new Decimal('1.50');
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
// Default fallback for unmapped competition codes:
const MODEL_SCORE_THRESHOLD_DEFAULT = new Decimal('0.60');

const MODEL_SCORE_THRESHOLD_MAP: Record<string, Decimal> = {
  // Tier A — efficient markets
  PL: new Decimal('0.58'),
  SA: new Decimal('0.60'),
  BL1: new Decimal('0.55'),
  LL: new Decimal('0.58'),
  L1: new Decimal('0.58'),
  J1: new Decimal('0.55'),
  MX1: new Decimal('0.55'),
  // Tier B — secondary / lower-division markets
  CH: new Decimal('0.50'),
  D2: new Decimal('0.55'),
  F2: new Decimal('0.58'),
  SP2: new Decimal('0.62'),
  // Raised 0.63 → 0.75 (audit 2026-04-04): -75% ROI on 9 bets, 1/9 wins.
  // Calibration is catastrophically wrong for I2 HOME; N < 50 means no valid
  // sub-segment exists. De facto suspension until ≥ 50 bets accumulate.
  I2: new Decimal('0.75'),
  EL1: new Decimal('0.50'),
  EL2: new Decimal('0.45'),
  // Tier C — European competitions (decided in prior session)
  LDC: new Decimal('0.45'),
  UEL: new Decimal('0.45'),
  UECL: new Decimal('0.45'),
  // Tier D — international competitions (conservative default — limited team
  // data, high variance, no historical backtest baseline yet).
  WCQE: new Decimal('0.60'),
  FRI: new Decimal('0.45'),
  UNL: new Decimal('0.60'),
  CAN: new Decimal('0.60'),
  COPA: new Decimal('0.60'),
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

// Per-(competition, market, pick) EV soft cap — rejects picks whose EV exceeds
// the ceiling, independently of the global EV_HARD_CAP (0.90).
//
// Use case: when a market segment shows that high-EV bets are MORE unprofitable
// than moderate-EV bets (model over-confidence pattern), an upper bound on EV
// acts as a calibration guard without full exclusion.
//
// Keys: "${competitionCode}|${market}|${pick}"
const PICK_EV_SOFT_CAP_MAP: Record<string, Decimal> = {
  // Audit 2026-04-04: EL1 HOME — EV [0.15–0.25) was the only profitable bucket
  // (+4.5% ROI on 33 bets). EV > 0.25 → -32% ROI on 16 bets; EV > 0.40 → -32%
  // on 16 bets. The model is increasingly wrong as confidence rises — cap at 0.25.
  'EL1|ONE_X_TWO|HOME': new Decimal('0.25'),
  // Audit 2026-04-04 (post-patch): D2 HOME remaining 7 bets at avg EV 0.360,
  // all lost or barely won. Over-calibration pattern confirmed — cap EV at 0.25.
  'D2|ONE_X_TWO|HOME': new Decimal('0.25'),
  // Audit 2026-04-04 (post-patch): PL HOME 19 bets at -13.4% ROI.
  // EV [0.20–0.40) → +9.6% on 9 bets. EV < 0.20 and EV >= 0.40 both negative.
  // Soft cap at 0.40 combined with per-pick EV floor at 0.20 creates the window.
  'PL|ONE_X_TWO|HOME': new Decimal('0.40'),
  // Audit 2026-04-04: CH HOME — 6 bets at avg EV 0.425, 1 win in 6 (-49.7% ROI).
  // Over-calibration pattern: model increasingly wrong at high EV (floor 3.00 already
  // set). EV [0.35+] concentrates the worst bets. Cap at 0.35 to reduce exposure
  // while preserving the rare low-EV HOME that cleared the 3.00 floor.
  'CH|ONE_X_TWO|HOME': new Decimal('0.35'),
};

// Per-(competition, market, pick) EV floor — overrides the league EV threshold
// for specific (competition, market, pick) tuples where the profitable range
// starts ABOVE the competition default.
//
// Keys: "${competitionCode}|${market}|${pick}"
const PICK_EV_FLOOR_MAP: Record<string, Decimal> = {
  // Audit 2026-04-04 (post-patch): EL1 DRAW — 10 bets, 9 losses. All bets had
  // EV 0.11–0.19, quality scores 0.062–0.110 (barely above thresholds). No edge
  // visible at any EV level. Raise floor to eliminate the segment.
  'EL1|ONE_X_TWO|DRAW': new Decimal('0.20'),
  // Audit 2026-04-04 (post-patch): EL2 DRAW — 3 bets, -100%, avg EV 0.123.
  // Borderline quality with no profitable signal.
  'EL2|ONE_X_TWO|DRAW': new Decimal('0.18'),
  // Audit 2026-04-04 (post-patch): F2 DRAW — 4 bets, -100%, EV 0.10–0.33.
  // All four outcomes were losses across a wide EV range — no usable edge.
  'F2|ONE_X_TWO|DRAW': new Decimal('0.20'),
  // Audit 2026-04-04 (post-patch): PL HOME — EV [0.12–0.20) → -38.9% on 7 bets.
  // Paired with soft cap at 0.40, this creates a [0.20, 0.40) window (+9.6% on 9 bets).
  'PL|ONE_X_TWO|HOME': new Decimal('0.20'),
};

export function getPickEvFloor(
  competitionCode: string | null,
  market: string,
  pick: string,
  leagueFloor: Decimal,
): Decimal {
  const key = `${competitionCode}|${market}|${pick}`;
  return PICK_EV_FLOOR_MAP[key] ?? leagueFloor;
}

export function getPickEvSoftCap(
  competitionCode: string | null,
  market: string,
  pick: string,
): Decimal {
  const key = `${competitionCode}|${market}|${pick}`;
  return PICK_EV_SOFT_CAP_MAP[key] ?? EV_HARD_CAP;
}

// Per-(competition, market, pick) maximum selection odds (ceiling).
// Complements getPickMinSelectionOdds() for cases where the profitable segment
// is at SHORT odds and medium/long odds are structurally unprofitable.
// Returns null for unmapped picks (no ceiling beyond global MAX_SELECTION_ODDS).
//
// Keys: "${competitionCode}|${market}|${pick}"
const PICK_MAX_SELECTION_ODDS_MAP: Record<string, Decimal> = {
  // Audit 2026-04-04: SP2 HOME placed (odds 1.80–2.70) was -21.5% ROI.
  // Rejected HOME blocked by odds_below_floor showed positive sim ROI — the
  // profitable segment is short-odds favorites (< 1.95), not medium-priced ones.
  // Combined with floor lowered to 1.50, this creates a [1.50, 1.95) window.
  'SP2|ONE_X_TWO|HOME': new Decimal('1.95'),
  // Audit 2026-04-04: PL DRAW was entirely blocked by the global MAX_SELECTION_ODDS
  // cap (4.0) — 164 rejected cases showed sim ROI +17.1% at EV >= 0.08. The sole
  // allowed DRAW (3.91, below cap) won at +2.91 profit. Raise the ceiling to 5.50
  // to admit the profitable > 4.0 segment. When a per-pick max is set it replaces
  // the global cap (see getPickRejectionReason), so this entry is authoritative.
  'PL|ONE_X_TWO|DRAW': new Decimal('5.50'),
};

export function getPickMaxSelectionOdds(
  competitionCode: string | null,
  market: string,
  pick: string,
): Decimal | null {
  const key = `${competitionCode}|${market}|${pick}`;
  return PICK_MAX_SELECTION_ODDS_MAP[key] ?? null;
}

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
