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
  // Audit 2026-04-05: I2 HOME — all picks land at avg odds 2.152 (2.0-2.49 bucket),
  // 2/10 wins (-54.6% ROI). Raising the probability gate to 0.99 (option 2) produced
  // identical results to the floor 2.50 (option 1) — I2 only generates HOME picks,
  // AWAY/DRAW never surface. Floor 2.50 retained as the explicit, documented guard.
  // Note: probability gate kept at 0.50 (set above) as an additional filter.
  'I2|ONE_X_TWO|HOME': new Decimal('0.50'),
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
  // European competitions: Pinnacle is a primary bookmaker for UCL/UEL/UECL.
  // Using the standard 2.00 floor — no historical evidence to deviate yet.
  UCL: new Decimal('2.00'),
  LDC: new Decimal('2.00'), // legacy alias
  UEL: new Decimal('2.00'),
  UECL: new Decimal('2.00'),
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

  // Championship 1X2 HOME: systematic model overestimation of P(home) on longshots.
  // Audit 2026-04-03: floor raised to 3.00 after [2.0-2.99] was -23.4% ROI (25b).
  // Audit 2026-04-05: 2 placed bets at odds 3.55 and 4.80 — both losses (-2u).
  // Model estimates P(home) ≥ 45% while market implies 21-28% — systematic bias.
  // [3.0-3.5) 30b at -12% (all prob<lim), [3.5-5.0) 2 placed both lost (-2u).
  // Floor raised to 5.00 → 0 CH HOME bets. CH becomes pure DRAW+AWAY+UNDER play.
  if (competitionCode === 'CH' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('5.00'));
  }

  // Backtest 2026-04-18: BL1 HOME [3.0-4.99] → 1W/9L across 3 seasons after lowering
  // MODEL_SCORE_THRESHOLD to 0.50. Previously floored at 3.00 (sweeps at 2.10/2.25/2.40
  // also failed). Pattern matches CH HOME — raise to 5.00 to eliminate the segment.
  if (competitionCode === 'BL1' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('5.00'));
  }

  // Audit 2026-04-04 (initial): D2 1X2 HOME picks were structurally negative in
  // the 2.0-2.99 bucket (-15.3% ROI on 32 bets). Floor raised to 2.50.
  // Audit 2026-04-04 (post-patch): remaining 7 bets had avg odds 2.72, still
  // -62.1% ROI. Pattern matches CH HOME and BL1 HOME — raise to 3.00 for parity.
  if (competitionCode === 'D2' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  // Audit 2026-04-05: PL HOME — 3 bets placed in [2.0-3.0), 1W/2L (-30.7% ROI, -0.92u).
  // All rejected HOME candidates (225b) are negative (-9.6% ev_below_threshold,
  // -6.6% prob<lim). Candidates in [3.0-3.5) are blocked by prob<lim (not odds).
  // Floor 3.0 eliminates all current placed bets → PL becomes pure DRAW play at
  // +37.6% ROI window [5.0, 5.50). No sub-segment above 3.0 passes prob gate.
  if (competitionCode === 'PL' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  // Audit 2026-04-05: I2 HOME — 10 bets at avg odds 2.152, all in [2.0-2.49] bucket,
  // 2/10 wins (-54.6% ROI). Model overestimates P(home) for short-priced favorites
  // even after HA factor correction. Floor 2.50 eliminates the entire toxic segment.
  // Probability gate 0.50 (above) tested as alternative — same 0-bet outcome confirmed.
  if (competitionCode === 'I2' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('2.50'));
  }

  // Backtest 2026-04-18: SA HOME [2.0-2.99] → 5 bets, 2W/3L, -16.6% ROI.
  // Same over-confidence pattern as BL1/CH/D2/PL HOME on mid-range odds.
  if (competitionCode === 'SA' && market === 'ONE_X_TWO' && pick === 'HOME') {
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

// Under 2.5 bets at high expected-goal totals are systematically losing — the
// independent Poisson model overestimates P(Under) when λ is high because real
// football matches exhibit overdispersion (variance > mean). When λ_home + λ_away
// exceeds this threshold, require a stricter EV floor before accepting UNDER picks.
// Calibrated on April 2026 prod data: 5 Under-2.5 losses at λ_total 2.57–3.23.
export const UNDER_HIGH_LAMBDA_THRESHOLD = 2.5;
export const UNDER_HIGH_LAMBDA_EV_FLOOR = new Decimal('0.20');

// Bayesian shrinkage — pulls raw Poisson lambdas toward the per-league mean goal rate.
// Formula: rawLambda = α × (xgFor × xgAgainst / leagueAvg) + (1 - α) × anchor
// where anchor = LEAGUE_MEAN_LAMBDA_MAP[code] ?? LEAGUE_MEAN_LAMBDA_DEFAULT.
// α = 0.70 keeps 70% of the team-specific signal and moderates extreme products.
// Computed from DB team_stats (April 2026, 7 leagues, includeInBacktest = true).
export const LAMBDA_SHRINKAGE_FACTOR = 0.7;

const LEAGUE_MEAN_LAMBDA_MAP: Record<string, number> = {
  // Raised 1.574 → 1.70: prod measurement 3.39 goals/match = 1.695/team.
  // Shrinkage anchor at 1.574 underestimated P(over 2.5) by ~2pp on average.
  BL1: 1.7,
  CH: 1.263,
  L1: 1.431,
  LL: 1.298,
  PL: 1.468,
  SA: 1.247,
  SP2: 1.449,
  // ERD: Eredivisie is one of the highest-scoring leagues in Europe (~3.3 goals/game).
  // Without this entry the default (1.4) is used, causing Poisson to massively
  // over-estimate extreme outcomes — 67 ev_above_hard_cap AWAY cases (avg EV 1.63)
  // and 18 ev_above_hard_cap DRAW cases (avg EV 1.49) in audit 2026-04-04.
  // Estimated from historical Eredivisie data; refine after stats sync.
  ERD: 1.75,
  // I2: Serie B mean lambda computed from team_stats (2,197 records, April 2026).
  // Without this entry the default (1.4) underestimates goal rate — same miscalibration
  // pattern as ERD. Correcting to 1.56 should fix Poisson probability bias and
  // recover the deterministic scores previously blocked by the 0.75 suspension threshold.
  I2: 1.56,
  // UCL: computed from team_stats (1,432 records, April 2026 — 3 seasons).
  // avg_xg_for=1.843, avg_xg_against=1.335, avg_lambda=1.589.
  // Previous value 1.35 was based on "elite defenses" assumption (~2.7 goals/game)
  // but DB measurement shows UCL runs closer to ~3.2 goals/game. Corrected.
  UCL: 1.59,
  LDC: 1.59, // legacy alias for UCL
  // UEL: computed from team_stats (1,326 records). avg_lambda=1.437 ≈ default 1.4.
  // No lambda correction needed — miscalibration is EV overconfidence, not lambda.
  UEL: 1.4,
  // UECL: computed from team_stats (2,253 records). avg_lambda=1.464 ≈ config 1.45.
  UECL: 1.45,
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

// Per-league home advantage overrides.
// Most leagues use the global 1.05 / 0.95 factors. Balanced divisions with
// more parity or lower tactical asymmetry require a smaller correction.
//
// I2 (Serie B): 22-team league with high promotion/relegation turnover and
// narrow squad investment gaps. Empirical home win rate ~44% vs ~50-52% in
// Serie A. Audit 2026-04-05: modeled P(home) averaged 56% on 26 bets placed
// while actual win rate was 27% — gap of 29pp. Reducing HA factor from 1.05
// to 1.02 (symmetric AWAY 0.98) closes this systematic bias.
const LEAGUE_HOME_ADVANTAGE_MAP: Record<string, [number, number]> = {
  // [homeAdvFactor, awayDisadvFactor]
  I2: [1.02, 0.98],
  // European competitions: home advantage is structurally lower than domestic
  // leagues (Dixon-Coles meta-analyses; UEFA Champions League empirical studies).
  // Teams that qualify are elite — talent gap is narrower and travel is managed.
  // Estimate: ~3% home advantage vs 5% global default. Refine after backtest.
  UCL: [1.03, 0.97],
  LDC: [1.03, 0.97], // legacy alias for UCL
  UEL: [1.04, 0.96],
  UECL: [1.04, 0.96],
};

export function getLeagueHomeAwayFactors(
  competitionCode: string | null | undefined,
): [number, number] {
  if (competitionCode != null && competitionCode in LEAGUE_HOME_ADVANTAGE_MAP) {
    return LEAGUE_HOME_ADVANTAGE_MAP[competitionCode];
  }
  return [HOME_ADVANTAGE_LAMBDA_FACTOR, AWAY_DISADVANTAGE_LAMBDA_FACTOR];
}

// MODEL_SCORE_THRESHOLD — minimum deterministic score required for a BET
// decision. Differentiated by market efficiency tier (audit finding: the flat
// 0.60 threshold blocked 7 winning picks on secondary-market fixtures).
//
// Default fallback for unmapped competition codes:
const MODEL_SCORE_THRESHOLD_DEFAULT = new Decimal('0.60');

const MODEL_SCORE_THRESHOLD_MAP: Record<string, Decimal> = {
  // Tier A — efficient markets
  PL: new Decimal('0.58'),
  // Lowered 0.60 → 0.55: 730/929 fixtures (78%) were skipped — SA tactical style produces
  // max_prob 0.52-0.57 on balanced matches. Combined with HOME floor 3.00 + UNDER eliminated,
  // newly unlocked fixtures feed better-filtered picks.
  SA: new Decimal('0.55'),
  // Lowered 0.55 → 0.50: balanced BL1 fixtures (max_prob ~0.45-0.55) were
  // entirely skipped before OVER_UNDER evaluation. BL1 has 3.39 goals/match
  // (67% over 2.5) — OVER picks need to enter the evaluation loop.
  BL1: new Decimal('0.50'),
  // Audit 2026-04-05: 0.58 → 0.55 tested — 10 new bets, -5.94u net regression.
  // Newly unlocked fixtures [0.55-0.58) generate false EV at [3.0-4.99] odds
  // (4 new bets, 4 losses, -4u). Threshold 0.58 is the correct filter for LL.
  // Reverted to 0.58.
  LL: new Decimal('0.58'),
  L1: new Decimal('0.58'),
  J1: new Decimal('0.55'),
  MX1: new Decimal('0.55'),
  // Tier B — secondary / lower-division markets
  CH: new Decimal('0.50'),
  D2: new Decimal('0.55'),
  F2: new Decimal('0.58'),
  SP2: new Decimal('0.62'),
  // Lowered 0.75 → 0.60 (audit 2026-04-05): root cause of HOME miscalibration
  // identified as HOME_ADVANTAGE_LAMBDA_FACTOR = 1.05 being too high for Serie B
  // (22-team balanced division, ~44% real home win rate). Per-league HA factor
  // corrected to 1.02/0.98 via getLeagueHomeAwayFactors(). Threshold back to Tier B.
  I2: new Decimal('0.60'),
  EL1: new Decimal('0.50'),
  EL2: new Decimal('0.45'),
  // Tier C — European competitions
  // Lower threshold reflects sparse early-season stats and cross-competition
  // stat blending which produces less certain deterministic scores.
  UCL: new Decimal('0.45'),
  LDC: new Decimal('0.45'), // legacy alias for UCL
  // Audit 2026-04-07: UEL AWAY bucket [3.0-4.99] — n=7, ROI -56%, EV 0.676 avg.
  // P_model 52.5% vs actual win_rate 31.9% (+20.6pp overconfidence gap). Threshold
  // raised to 0.55 to filter low-certainty fixtures generating false EV.
  UEL: new Decimal('0.55'),
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

// ─── European competitions ───────────────────────────────────────────────────

// All competition codes treated as European (UCL/UEL/UECL + legacy alias LDC).
const EUROPEAN_COMPETITION_CODE_SET = new Set(['UCL', 'UEL', 'UECL', 'LDC']);

export function isEuropeanCompetition(
  code: string | null | undefined,
): boolean {
  return code != null && EUROPEAN_COMPETITION_CODE_SET.has(code);
}

// Cross-competition form blending weights for European fixture analysis.
// European recentForm is weighted higher (direct competitive context).
// Domestic xg is weighted higher (30+ match sample vs 5-8 European matches).
export const EUROPEAN_CROSS_COMP_FORM_WEIGHT = 0.6;
export const EUROPEAN_CROSS_COMP_XG_WEIGHT = 0.4;

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
  // Audit 2026-04-05: I2 HOME — EV >= 0.40 had 0% win rate (0/4 bets) even after
  // lambda correction. Over-confidence pattern confirmed. Cap at 0.35 to eliminate
  // the high-EV overconfident segment while preserving moderate-EV picks.
  'I2|ONE_X_TWO|HOME': new Decimal('0.35'),
  // Audit 2026-04-04 (post-patch): PL HOME 19 bets at -13.4% ROI.
  // EV [0.20–0.40) → +9.6% on 9 bets. EV < 0.20 and EV >= 0.40 both negative.
  // Soft cap at 0.40 combined with per-pick EV floor at 0.20 creates the window.
  'PL|ONE_X_TWO|HOME': new Decimal('0.40'),
  // Audit 2026-04-04: CH HOME — 6 bets at avg EV 0.425, 1 win in 6 (-49.7% ROI).
  // Over-calibration pattern: model increasingly wrong at high EV (floor 3.00 already
  // set). EV [0.35+] concentrates the worst bets. Cap at 0.35 to reduce exposure
  // while preserving the rare low-EV HOME that cleared the 3.00 floor.
  'CH|ONE_X_TWO|HOME': new Decimal('0.35'),
  // Audit 2026-04-07: UEL AWAY — n=7, ROI -56%, all bets EV >= 0.35. Model
  // over-confidence gap +20.6pp (P_model 52.5% vs win_rate 31.9%). Cap at 0.35
  // as a calibration guard — eliminates the high-EV overconfident segment.
  'UEL|ONE_X_TWO|AWAY': new Decimal('0.35'),
  // Audit 2026-04-07: UEL HOME — 22 bets, ROI -19%, avg EV 0.474. Same
  // overconfidence pattern as EL1/CH/D2 HOME: model increasingly wrong as EV rises.
  // Cap at 0.35 to cut the high-EV segment while keeping moderate-EV HOME picks.
  'UEL|ONE_X_TWO|HOME': new Decimal('0.35'),
  // Audit 2026-04-07: UECL AWAY — 11 bets, ROI -53.3%, avg EV 0.537. Identical
  // overconfidence pattern to UEL AWAY (high EV, low actual win rate). EV soft cap
  // at 0.35 eliminates the overconfident segment — more targeted than a prob gate.
  'UECL|ONE_X_TWO|AWAY': new Decimal('0.35'),
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
  // Backtest 2026-04-18: SA HOME — reduce low-quality entries (SA-3).
  // Floor 0.12 retains only picks with stronger model confidence.
  'SA|ONE_X_TWO|HOME': new Decimal('0.12'),
  // Backtest 2026-04-18: SA DRAW >=5.0 — 3 bets, 0W/3L after threshold lowered to 0.55.
  // Model over-confidence on draw outcomes in a balanced tactical league. Eliminate.
  'SA|ONE_X_TWO|DRAW': new Decimal('0.99'),
  // Backtest 2026-04-18: SA UNDER — 9 bets, 3W/6L, -34.9% ROI. Model lambda SA=1.247
  // places P(under 2.5) ~54% but actual win rate is 33% — systematic overconfidence.
  // SA sits at the over/under boundary (2.49 avg goals); no reliable UNDER edge exists.
  // Floor 0.99 effectively eliminates all SA UNDER picks.
  'SA|OVER_UNDER|UNDER': new Decimal('0.99'),
};

// eslint-disable-next-line max-params
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
  // Backtest 2026-04-18: BL1 AWAY at [3.0-4.99] → 1W-6L, -54% ROI across 3 seasons.
  // AWAY at [2.0-2.99] was 2W-0L. Cap at 2.99 to eliminate the losing segment.
  'BL1|ONE_X_TWO|AWAY': new Decimal('2.99'),
};

export function getPickMaxSelectionOdds(
  competitionCode: string | null,
  market: string,
  pick: string,
): Decimal | null {
  const key = `${competitionCode}|${market}|${pick}`;
  return PICK_MAX_SELECTION_ODDS_MAP[key] ?? null;
}

// ─── Safe Value flux ──────────────────────────────────────────────────────────
//
// A secondary pick-selection channel that targets high-probability single-market
// bets (P ≥ 68%) with non-negative EV — distinct from the EV-primary channel.
// Safe value picks are published alongside the EV pick as a separate "safe" channel.
// These constants define the eligibility window for the safe value pool.

// Minimum probability for a safe value pick (strict — P < 0.68 is excluded).
export const SAFE_VALUE_MIN_PROBABILITY = new Decimal('0.68');

// Adverse line movement threshold: if odds drop by >10% over 7 days, exclude the pick.
export const LINE_MOVEMENT_THRESHOLD = new Decimal('0.10');

// Minimum EV for safe value bets. Near-zero EV picks (< 0.05) show no reliable
// edge with the Poisson model — backtest 2026-04-13 shows OVER_1_5 at EV 0.004–0.039
// losing more often than the probability estimate predicts.
export const SAFE_VALUE_MIN_EV = new Decimal('0.05');

// Odds window: allow shorter odds than the EV floor but cap to avoid mid-range
// picks where bookmaker margin erodes expected value disproportionately.
export const SAFE_VALUE_MIN_ODDS = new Decimal('1.15');
export const SAFE_VALUE_MAX_ODDS = new Decimal('2.20');

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
