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
  // gate were strongly profitable in backtest (+15.9% ROI on 131 picks), so the
  // branch was initially relaxed to 0.40. Backtest 2026-04-18 still clears ROI
  // after odds caps and HA correction but remains slightly over-confident on Brier;
  // tighten modestly to 0.42 rather than reverting to the global 0.45.
  'D2|ONE_X_TWO|AWAY': new Decimal('0.42'),
  // Backtest 2026-04-18: ERD only places HOME picks and they all sit in the
  // 2.0-2.99 bucket at 2W/5, -14.4% ROI. Raise the directional confidence bar
  // before allowing another Eredivisie home favorite at mid-range odds.
  'ERD|ONE_X_TWO|HOME': new Decimal('0.60'),
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
  // Backtest 2026-04-19 ndjson: 92 AWAY picks blocked by probability_too_low at odds
  // [5.0–7.0] → 26W/66L, +39.7% simROI (winrate 28.3% vs breakeven 20.2% at avg 4.94).
  // Default 0.45 gate eliminates this profitable segment. Lowering to 0.30 unlocks
  // picks where P_away ∈ [0.30, 0.45) — paired with odds cap 6.99 to exclude the
  // [7.0–10.0] bucket (2W/24L, -37.2% ROI) which is not salvageable.
  'PL|ONE_X_TWO|AWAY': new Decimal('0.30'),
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
  // J1 backtest 2026-04-25: OVER in the 1.80-1.99 range was 8W/11L (-23.4% ROI, 19 bets)
  // while OVER 2.0+ was 5W/4L (+12.6%). Raising the floor eliminates the toxic short-odds
  // OVER segment without touching the profitable 2.0-2.99 range.
  J1: new Decimal('2.00'),
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

  // Backtest 2026-04-19: BL1 BTTS NO [2.0-2.99] ≈ 11 bets, ~-51.6% ROI (derived:
  // total BTTS [2.0-2.99] 21 bets -4.1%; BTTS YES 10 bets all at avg 2.116 +48.1%).
  // NO [3.0-4.99] 7 bets +92.1% ROI. BL1 scores 3.39 goals/match — BTTS NO at short
  // odds bets on a 25-30% outcome at 2.2-2.9 (structurally negative EV against sharp
  // market). Floor 3.00 retains the profitable long-odds NO segment.
  if (competitionCode === 'BL1' && market === 'BTTS' && pick === 'NO') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  // Backtest 2026-04-18: D2 HOME remaining bets sit at 3.05 and 3.21 after the
  // earlier 3.00 floor, both losses. Keep the 3.00 odds guard to exclude the
  // structurally bad 2.0-2.99 bucket, but do not fully eliminate HOME so a future
  // high-conviction sub-segment can still surface once calibration improves.
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

  // J1 audit 2026-04-25: HOME is structurally unreliable — 46 bets 19W/27L (-6.3% ROI).
  // Per-season win rate varies from 18% (S1) to 59% (S3) despite similar odds range.
  // High-EV HOME picks lose more often than low-EV ones (avg EV 0.328 on losses vs
  // 0.245 on wins) — the model cannot distinguish good from bad HOME picks in J.League.
  // Pattern matches BL1/CH: eliminate HOME entirely from J1 picks.
  if (competitionCode === 'J1' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('5.00'));
  }

  // Backtest 2026-04-18: SA HOME [2.0-2.99] → 5 bets, 2W/3L, -16.6% ROI.
  // Same over-confidence pattern as BL1/CH/D2/PL HOME on mid-range odds.
  if (competitionCode === 'SA' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
  }

  // LL backtest 2026-04-24 after side-market cleanup: FIRST_HALF_WINNER DRAW
  // remains mildly positive overall, but the signal is concentrated in the
  // 3.5-3.99 slice (4W/6, +143% ROI). The 3.0-3.49 band is clearly negative
  // (3W/17, -41.1% ROI), so tighten by odds instead of disabling the branch.
  if (
    competitionCode === 'LL' &&
    market === 'FIRST_HALF_WINNER' &&
    pick === 'DRAW'
  ) {
    return Decimal.max(leagueFloor, new Decimal('3.50'));
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

  // L1 backtest 2026-04-19: HOME is strongly profitable in 2.0-2.99 but loses as
  // soon as the odds extend into 3.0-4.99. Keep the core home-favorite window only.
  if (competitionCode === 'L1' && market === 'ONE_X_TWO' && pick === 'HOME') {
    return Decimal.max(leagueFloor, new Decimal('2.00'));
  }

  // L1 ndjson 2026-04-19: BTTS YES is only dragged down by the 2.00-2.09 slice
  // (0W/2L). The remaining 2.10+ window stays positive on the current sample, so
  // raise the floor slightly instead of removing the branch entirely.
  if (competitionCode === 'L1' && market === 'BTTS' && pick === 'YES') {
    return Decimal.max(leagueFloor, new Decimal('2.10'));
  }

  // EL1 backtest 2026-04-24: the only remaining FHW branch is AWAY. The sole
  // sub-3.00 pick lost despite a very high displayed EV (2.94, EV 0.41), while
  // the observed positive cluster starts at 3.21 and is strongest around 3.5-3.7.
  if (
    competitionCode === 'EL1' &&
    market === 'FIRST_HALF_WINNER' &&
    pick === 'AWAY'
  ) {
    return Decimal.max(leagueFloor, new Decimal('3.00'));
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
  // I2: Serie B remains one of the most draw-heavy leagues in the pool (~32% draws).
  // Even after the earlier 1.45 → 1.1 correction, the latest reruns still needed
  // extra draw support. Keep the 0.95 anchor as the best compromise for totals,
  // and let the empirical 1X2 blend handle the remaining directional calibration
  // instead of pushing lambda lower again.
  I2: 0.95,
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
  // D2: 2. Bundesliga — per-season home win rates: S1=42.7%, S2=46.1%, S3=44.9%.
  // 2026-04-18: HA 1.01/0.99 worsened Brier vs 1.02/0.98 — keep mild override.
  // 2026-04-25: S2 calibration fix attempted via HA neutralization; the empirical
  // blend (0.30) captures the inter-season variance more cleanly without HA change.
  D2: [1.02, 0.98],
  // I2 latest rerun still spreads too much probability to home/away tails despite
  // the disabled 1X2 branches. Neutralize home advantage completely to lift draw
  // probability in this very balanced league.
  // 2026-04-24: HA 1.06/0.94 tested for Brier improvement (0.658→0.655) but
  // shifted UNDER_1_5 EV calculations and generated 4 extra losing picks. The
  // per-league Brier threshold (0.66) makes HA tuning unnecessary — revert to
  // 1.00/1.00 to keep UNDER_1_5 volume clean.
  I2: [1.0, 1.0],
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

// League-specific 1X2 empirical rebalance applied after Poisson computation.
// The Poisson core remains the primary signal; this weight blends the raw
// HOME/DRAW/AWAY vector toward empirical team rates derived from TeamStats.
// Use sparingly for leagues where xG-only probabilities stay miscalibrated.
const THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP: Record<string, Decimal> = {
  // I2 backtest 2026-04-24: after lowering lambda and neutralizing HA, ROI
  // became healthy again but Brier still failed at 0.669 and calibration at
  // 0.056. The remaining issue is the 1X2 distribution: TeamStats already
  // carries homeWinRate / awayWinRate / drawRate, but Poisson uses only xG.
  // Blend 45% toward those empirical rates to reduce over-confident tails
  // without disturbing totals markets, which are already the profitable axis.
  I2: new Decimal('0.45'),
  // D2 audit 2026-04-25: S2 (2024-25) Brier 0.6915 vs floor 0.6416 — the model
  // over-predicts away wins (S1 had 32.7% away rate; S2 collapsed to 28.7%).
  // The Poisson core doesn't see team roster changes at season boundaries; the
  // empirical blend pulls 1X2 toward per-team actual rates, reducing S2 noise.
  // Tested 0.25/0.35/0.45: 0.30 is the Brier optimum (0.651 overall).
  // Side-effect: DRAW picks at ~4.0 odds emerge (6 bets 3W/3L, +99% ROI).
  D2: new Decimal('0.30'),
  // F2 audit 2026-04-24: the league fails Brier by a narrow margin (0.659 vs
  // 0.65) while 1X2 HOME remains profitable. Test a light empirical rebalance
  // before touching home-advantage or selection filters.
  F2: new Decimal('0.30'),
  // J1 audit 2026-04-25: Brier 0.6741 (FAIL). Actual J1 rates: 41.4%H/26.5%D/32.1%A.
  // Model over-predicts HOME wins — high-EV picks lose more than low-EV (0.328 vs 0.245).
  // Blend 0.30 improved Brier to 0.6659 but S4 (early-season 2026, Brier 0.7157) keeps
  // the average above 0.65. Blend 0.40 applies stronger correction to reduce the
  // systematic HOME over-confidence across all seasons.
  J1: new Decimal('0.40'),
};

export function getLeagueThreeWayEmpiricalBlendWeight(
  competitionCode: string | null | undefined,
): Decimal {
  if (
    competitionCode != null &&
    competitionCode in THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP
  ) {
    return THREE_WAY_EMPIRICAL_BLEND_WEIGHT_MAP[competitionCode];
  }
  return new Decimal(0);
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
  // Backtest 2026-04-19: POR is extremely selective (7 bets / 3 seasons) while
  // still posting strong calibration and Brier. The main blocker is the default
  // 0.60 fixture gate (582 skips), with 36 fixtures parked just below the cut in
  // [0.58, 0.60). Lower only the fixture threshold first; keep the existing EV
  // and odds filters because rejected DRAW/AWAY longshots remain structurally bad.
  POR: new Decimal('0.58'),
  J1: new Decimal('0.55'),
  MX1: new Decimal('0.55'),
  // Backtest 2026-04-18: threshold raised to 0.68 to block bad HOME picks.
  // Audit 2026-04-25: 0.68 blocks ALL fixtures (max ERD score = 0.679). Restored
  // to 0.55 — the per-pick floors now handle HOME/UNDER/BTTS/FHW selectively.
  ERD: new Decimal('0.55'),
  // Tier B — secondary / lower-division markets
  CH: new Decimal('0.50'),
  D2: new Decimal('0.55'),
  F2: new Decimal('0.58'),
  // Backtest 2026-04-19: SP2 only places 20 bets across 3 seasons despite strong
  // realized ROI (+33.7%). The dominant ndjson blocker is BELOW_MODEL_SCORE_THRESHOLD
  // (1054 fixtures), with 153 fixtures concentrated just below the cut in [0.58, 0.62).
  // Keep the proven per-pick SP2 HOME window [1.50, 1.95) and OVER [2.0-2.99] filters,
  // but lower the fixture gate to 0.58 so balanced Segunda matches can reach market
  // evaluation instead of being discarded upfront.
  SP2: new Decimal('0.58'),
  // Lowered 0.75 → 0.60 (audit 2026-04-05): HA factor corrected to 1.02/0.98.
  // Lowered 0.60 → 0.50 (2026-04-18): ndjson audit showed the league is structurally
  // balanced and rarely clears a high deterministic score. A later 0.45 test re-opened
  // noisy 1X2/HT branches without improving the league, so keep 0.50 as the fixture gate.
  // 2026-04-24: tested 0.47 — unlocked 144 fixtures but produced 5 extra losing UNDER_1_5
  // and a toxic FHW AWAY. Signal degrades sharply below 0.50. Keep 0.50 as the floor.
  I2: new Decimal('0.50'),
  EL1: new Decimal('0.50'),
  // Backtest 2026-04-18: EL2 has strong ROI but fails Brier by a hair (0.6508).
  // The issue is the massive 1X2 volume in the 2.0-2.99 bucket (155 bets, ROI +7%),
  // not the profitable 3.0-4.99 sub-segment or HT over 1.5. 0.48 improved ROI and
  // reduced volume without moving Brier; test 0.50 as the next small step.
  EL2: new Decimal('0.50'),
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

// Combo picks (multi-leg accumulators) are disabled during the single-pick
// calibration phase. The backtest tracks combos under their primary market
// (market1), making it impossible to distinguish single vs combo performance
// in marketPerformance stats. Re-enable once all leagues are calibrated and
// a dedicated COMBO market key is added to the backtest reporting.
export const COMBOS_ENABLED = false;

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
  // EL1 backtest 2026-04-24: the surviving FHW AWAY branch turns negative as soon
  // as displayed EV exceeds ~0.25. Placed bets at EV 0.25-0.35 went 0W/4L, while
  // the 0.18-0.25 window remained the only clearly positive slice.
  'EL1|FIRST_HALF_WINNER|AWAY': new Decimal('0.25'),
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
  // EL1 backtest 2026-04-24: FHW AWAY is only convincing in the middle EV band.
  // EV < 0.18 went 2W/8 (-9.9% ROI), and EV > 0.25 is already cut by soft cap.
  'EL1|FIRST_HALF_WINNER|AWAY': new Decimal('0.18'),
  // Backtest 2026-04-24: EL1 BTTS remains negative on both directions across the
  // latest 3-season run (YES 2W/7, -39.1% ROI; NO 6W/17, -22.3% ROI). No usable
  // sub-segment appears in the current sample, while 1X2 carries the league.
  'EL1|BTTS|YES': new Decimal('0.99'),
  'EL1|BTTS|NO': new Decimal('0.99'),
  // Backtest 2026-04-24: EL1 first-half winner is only marginally positive on
  // AWAY (+0.91u on 17 bets) but structurally bad on HOME (12W/39, -13.5% ROI)
  // and DRAW (0W/1). Remove the toxic branches and keep only the observable AWAY.
  'EL1|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  'EL1|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  // Backtest 2026-04-24: EL1 totals diverge by direction. UNDER stays positive
  // (+35.7% ROI on 9 bets), while OVER and OVER 3.5 combine for -4.8u on 13 bets.
  // Keep the under branch and eliminate the structurally losing overs.
  'EL1|OVER_UNDER|OVER': new Decimal('0.99'),
  'EL1|OVER_UNDER|OVER_3_5': new Decimal('0.99'),
  // Backtest 2026-04-24: EL1 HT over 1.5 remains negative even after the 2.99 cap
  // (2W/8, -37.5% ROI). The half-time Poisson split is too noisy here; disable it.
  'EL1|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
  // Audit 2026-04-04 (post-patch): EL2 DRAW — 3 bets, -100%, avg EV 0.123.
  // Borderline quality with no profitable signal.
  'EL2|ONE_X_TWO|DRAW': new Decimal('0.18'),
  // Backtest 2026-04-18: EL2 had a single FIRST_HALF_WINNER AWAY bet, 0W/1L.
  // No evidence of a usable edge; remove the noise before tuning the main market.
  'EL2|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  // D2 backtest 2026-04-19: the lone FIRST_HALF_WINNER AWAY pick lost and there is
  // no evidence of a reusable edge in this side market. Keep focus on 1X2 AWAY.
  'D2|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  // D2 backtest 2026-04-19: OVER_UNDER_HT OVER_1_5 surfaced once at 2.65 and lost.
  // No evidence of a durable edge; keep the league focused on the 1X2 AWAY signal.
  'D2|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
  // Backtest 2026-04-18: EL2 OVER surfaced once at 2.15 and lost. Keep EL2 totals
  // focus on the profitable HT over 1.5 signal instead of sparse full-time OVER.
  'EL2|OVER_UNDER|OVER': new Decimal('0.99'),
  // Audit 2026-04-04 (post-patch): F2 DRAW — 4 bets, -100%, EV 0.10–0.33.
  // All four outcomes were losses across a wide EV range — no usable edge.
  'F2|ONE_X_TWO|DRAW': new Decimal('0.99'),
  // Backtest 2026-04-18: F2 AWAY surfaced twice and lost twice at avg odds 4.41
  // with inflated EV. No evidence of a viable away signal — remove it for now.
  'F2|ONE_X_TWO|AWAY': new Decimal('0.99'),
  // Audit 2026-04-04 (post-patch): PL HOME — EV [0.12–0.20) → -38.9% on 7 bets.
  // Paired with soft cap at 0.40, this creates a [0.20, 0.40) window (+9.6% on 9 bets).
  'PL|ONE_X_TWO|HOME': new Decimal('0.20'),
  // Backtest 2026-04-18: D2 HOME should remain observable, but only with stronger
  // signal than the league default. Pair with the 3.00 odds floor and reduced HA.
  'D2|ONE_X_TWO|HOME': new Decimal('0.12'),
  // D2 backtest/ndjson 2026-04-19: UNDER remains toxic when it surfaces, and the
  // rejected under_high_lambda branch is mostly negative as well. Remove the market
  // while calibrating the stronger 1X2 AWAY signal.
  'D2|OVER_UNDER|UNDER': new Decimal('0.99'),
  // Backtest 2026-04-18: ERD HOME at odds 2.02-2.36 goes 2W/5 with avg EV 0.184
  // and negative ROI. Keep the market alive but require a stronger edge signal.
  'ERD|ONE_X_TWO|HOME': new Decimal('0.15'),
  // Backtest 2026-04-18: ERD UNDER surfaced once at 3.39 and lost. High Eredivisie
  // goal environment plus dominant teams make model-derived UNDER value suspect.
  'ERD|OVER_UNDER|UNDER': new Decimal('0.99'),
  // Audit 2026-04-25: UNDER_3_5 appeared once (odds 2.51) and lost — same structural
  // argument as UNDER: Eredivisie averages 3.3 goals/game, UNDER is systematically bad.
  'ERD|OVER_UNDER|UNDER_3_5': new Decimal('0.99'),
  // Audit 2026-04-25: BTTS NO appeared once (odds 3.0) and lost — high-lambda league
  // produces both teams scoring frequently; BTTS NO has no edge here.
  'ERD|BTTS|NO': new Decimal('0.99'),
  // Backtest 2026-04-18: ERD OVER_1_5 HT surfaced once and lost; the market is too
  // sparse and noisy to keep in scope while fixing ROI. Disable for now.
  'ERD|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
  // Audit 2026-04-25: FHW DRAW surfaced once (odds 3.64) and lost — insufficient
  // signal to justify keeping this market alive in ERD.
  'ERD|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  // Audit 2026-04-25: MX1 UNDER surfaced once (odds 2.72) and lost.
  'MX1|OVER_UNDER|UNDER': new Decimal('0.99'),
  // Audit 2026-04-25: MX1 OVER_3_5 surfaced once (odds 3.04) and lost.
  'MX1|OVER_UNDER|OVER_3_5': new Decimal('0.99'),
  // Audit 2026-04-25: MX1 OVER (25 bets, +2.2% ROI) is dragged by S1 (-28% on 11
  // bets). S2/S3 OVER are profitable (+15%/+92%) but S1 contaminates the signal.
  // No clean odds-range or EV cutoff separates wins from losses — the issue is
  // seasonal model calibration on the OVER market, not a specific odds window.
  // HOME (17 bets, +14.6% ROI) is the only confirmed signal; disable OVER.
  'MX1|OVER_UNDER|OVER': new Decimal('0.99'),
  // Audit 2026-04-25: MX1 OVER_1_5 HT surfaced once and lost.
  'MX1|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
  // Audit 2026-04-25: MX1 FHW DRAW and HOME each surfaced once and lost.
  'MX1|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  'MX1|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  // J1 backtest 2026-04-25: DRAW emerged after empirical blend (5b 1W/4L, -26.4% ROI).
  // Blend shifts probability toward actual 26.5% draw rate but J1 DRAWs lack exploitable
  // edge against Pinnacle lines at 3.5-4.0 odds.
  'J1|ONE_X_TWO|DRAW': new Decimal('0.99'),
  // J1 backtest 2026-04-25: UNDER surfaced once (1.92 odds, LOSS -100%). No edge.
  'J1|OVER_UNDER|UNDER': new Decimal('0.99'),
  // J1 backtest 2026-04-25: OVER_HT surfaced once (3.2 odds, LOSS -100%). No edge.
  'J1|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
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
  // Backtest 2026-04-18: I2 ONE_X_TWO is structurally broken — AWAY 30b 8W/22L avg EV
  // 0.517 (over-confidence), HOME 6b 1W/5L -57.5%. Floors maintained.
  'I2|ONE_X_TWO|AWAY': new Decimal('0.99'),
  'I2|ONE_X_TWO|HOME': new Decimal('0.99'),
  // Backtest 2026-04-19 (baseline propre sans combos): OVER 2.5 était le seul signal
  // avec combos (+22.9%) mais s'effondre sans combos (6W/16L = -44%). Signal combinatoire,
  // pas un edge sur le marché OVER seul. EV moyen 0.278 = lambda trop élevé (corrigé 1.45→1.1).
  // Hard floor en complément pour éviter tout résidu après correction lambda.
  'I2|OVER_UNDER|OVER': new Decimal('0.99'),
  // Backtest 2026-04-24: empirical 1X2 blending improves I2 calibration but the
  // reopened DRAW branch still loses badly on the current 3-season sample
  // (22 bets, ROI -20%). Keep the calibration benefit, but do not monetize it
  // until a profitable DRAW window is demonstrated.
  'I2|ONE_X_TWO|DRAW': new Decimal('0.99'),
  // Backtest 2026-04-24: the only I2 half-time over branch placed twice at 3.14/3.29
  // and lost twice (-2u). With 0 candidates surviving elsewhere on the HT totals axis,
  // this market is noise, not a reusable edge. Keep I2 focused on full-time unders.
  'I2|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
  // Backtest 2026-04-24: raising HA to 1.06/0.94 for Brier calibration unlocked
  // BTTS NO (1 bet, 0W/1L), FHW HOME (1 bet, 0W/1L) and FHW AWAY (1 bet, 0W/1L
  // at threshold 0.47). All are single-event noise with no reusable edge — disable
  // before HA correction or threshold changes destabilise the signal.
  'I2|BTTS|NO': new Decimal('0.99'),
  'I2|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  'I2|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  // Backtest 2026-04-19: PL FIRST_HALF_WINNER — 29 bets, 7W/22L, -22.4% ROI across 3 seasons.
  // All directions negative: DRAW 18b -10%, HOME 8b -21%, AWAY 3b -100%.
  // Model systematically over-confident on PL HT winner — no exploitable edge in any direction.
  'PL|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  'PL|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  'PL|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  // Backtest 2026-04-19: PL BTTS divergence — YES 16b 9W/7L +29.4% vs NO 9b 2W/7L -33.9%.
  // PL is a high-scoring league (avg ~2.83 goals/match); model over-assigns P(no BTTS).
  // Keep YES direction open, eliminate NO entirely.
  'PL|BTTS|NO': new Decimal('0.99'),
  // Backtest 2026-04-19: BL1 FIRST_HALF_WINNER HOME — 14 bets, 1W/13L, -71.6% ROI.
  // AWAY is profitable (+26.6%, 26 bets) and DRAW is near break-even (-1.5%, 28 bets).
  // HOME is the sole toxic direction — same over-confidence pattern as PL FHW HOME.
  'BL1|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  // SP2 ndjson 2026-04-19: 1X2 AWAY is the clearest toxic branch. Rejected AWAY
  // candidates are near-flat at 3.0-4.99 and strongly negative above 5.0, while
  // the lone placed AWAY at 3.05 lost. Remove the branch to bias SP2 toward the
  // higher-hit-rate HOME and OVER signals.
  'SP2|ONE_X_TWO|AWAY': new Decimal('0.99'),
  // POR ndjson 2026-04-19: 1X2 DRAW is mostly blocked by the default EV floor.
  // 2026-04-25: EV split is sharp — EV ≥ 0.20 yields 3W/1L (+263% ROI, avg odds 4.82)
  // while EV < 0.20 yields 1W/4L (4 losses, 1 win at 4.33). Set floor to 0.20 to
  // admit only high-conviction draws (removes 4 losses and 1 low-EV win).
  'POR|ONE_X_TWO|DRAW': new Decimal('0.20'),
  // L1 backtest 2026-04-19: BTTS NO is the wrong side of the market (2W/6L, -23.8%),
  // while BTTS YES stays mildly positive. Remove NO and keep the lighter YES branch.
  'L1|BTTS|NO': new Decimal('0.99'),
  // LL backtest 2026-04-24: BTTS is the main ROI drag in La Liga.
  // YES: 8W/19, -7.6% ROI. NO: 3W/10, -33.6% ROI.
  // No sub-window shows durable edge on the current 3-season sample.
  'LL|BTTS|YES': new Decimal('0.99'),
  'LL|BTTS|NO': new Decimal('0.99'),
  // BL1 backtest 2026-04-24: FHW DRAW places 29 bets for -4.9% ROI across three
  // seasons, while FHW AWAY remains the profitable half-time direction. No clean
  // sub-window emerged in the latest run, so remove DRAW and keep the stronger AWAY.
  'BL1|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  // BL1 backtest 2026-04-24: HT/FT HOME_HOME surfaced once at 3.60 and lost.
  // No reusable signal on this branch; keep BL1 focused on BTTS, FHW AWAY and OVER.
  'BL1|HALF_TIME_FULL_TIME|HOME_HOME': new Decimal('0.99'),
  // BL1 backtest 2026-04-24: UNDER_3_5 surfaced once at 2.35 and lost. The
  // league's high-scoring profile keeps this defensive total out of scope.
  'BL1|OVER_UNDER|UNDER_3_5': new Decimal('0.99'),
  // LL backtest 2026-04-24 after the FHW-DRAW tightening: HT UNDER 1.5 still
  // places 8 bets for 1W/7L (-77.1% ROI), and the two rejected low-EV cases
  // also lost. No clean odds window emerges; keep only the most extreme
  // conviction slice instead of disabling the branch outright.
  'LL|OVER_UNDER_HT|UNDER_1_5': new Decimal('0.24'),
  // LL backtest 2026-04-24: first-half winner only survives on DRAW and even
  // that branch is fragile. HOME is clearly toxic (3W/10, -28.1% ROI) and AWAY
  // has no support at all (0W/2). Remove both to keep the league on cleaner axes.
  'LL|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  'LL|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  // L1 backtest 2026-04-19: all FIRST_HALF_WINNER directions are negative overall
  // (5W/20L, -25.1% ROI). No sub-direction justifies keeping the market active.
  'L1|FIRST_HALF_WINNER|HOME': new Decimal('0.99'),
  'L1|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  'L1|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  // CH backtest 2026-04-19: FHW AWAY 22 bets 1W/21L -86.8% ROI — same structural
  // over-confidence as PL and BL1 (model overestimates P(home HT win), AWAY suffers).
  // FHW DRAW 7 bets 2W/5L -19% across both seasons (S2 -7.3%, S3 -27.7%): low volume
  // but consistently negative — eliminate to keep CH on the FHW HOME signal only.
  // FHW HOME 35 bets +43.9% ROI [2.0-2.99 +38.4%, 35 bets] — retained.
  'CH|FIRST_HALF_WINNER|AWAY': new Decimal('0.99'),
  'CH|FIRST_HALF_WINNER|DRAW': new Decimal('0.99'),
  // CH latest backtest/prod comparison 2026-04-24: 1X2 HOME has no durable edge.
  // Backtest places no useful HOME branch under the current config, rejected HOME
  // candidates remain negative overall, and the recent prod sample added 3 straight
  // HOME losses. Remove the branch and keep CH focused on BTTS/HT/totals.
  'CH|ONE_X_TWO|HOME': new Decimal('0.99'),
  // CH backtest 2026-04-19: 1X2 DRAW 9 bets 1W/8L -56.9% ROI (all [3.0-4.99]).
  // Model overestimates P(draw) on the Championship's high-turnover mid-table
  // fixtures. HOME already floored at 5.00; DRAW eliminated to leave only AWAY.
  'CH|ONE_X_TWO|DRAW': new Decimal('0.99'),
  // CH backtest 2026-04-19: BTTS YES 4 bets 0W/4L -100%. CH avg ~2.52 goals/match
  // — model over-assigns P(btts yes) in the short-odds range. BTTS NO +27.2% retained.
  'CH|BTTS|YES': new Decimal('0.99'),
  // L1 backtest 2026-04-19: full-time totals are negative on both directions and
  // half-time over 1.5 surfaced twice for two losses. Keep the league focused on
  // the cleaner 1X2 HOME and BTTS YES branches.
  'L1|OVER_UNDER|OVER': new Decimal('0.99'),
  'L1|OVER_UNDER|UNDER': new Decimal('0.99'),
  'L1|OVER_UNDER_HT|OVER_1_5': new Decimal('0.99'),
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
  // Backtest 2026-04-18 plus prod dashboard: EL1 HT over 1.5 is pulled down by
  // the 3.0-4.99 slice (0W/3 in backtest), while 2.0-2.99 remains positive.
  // Keep the market alive, but cap the long half-time prices.
  'EL1|OVER_UNDER_HT|OVER_1_5': new Decimal('2.99'),
  // Audit 2026-04-04: PL DRAW was entirely blocked by the global MAX_SELECTION_ODDS
  // cap (4.0) — 164 rejected cases showed sim ROI +17.1% at EV >= 0.08. The sole
  // allowed DRAW (3.91, below cap) won at +2.91 profit. Raise the ceiling to 5.50
  // to admit the profitable > 4.0 segment. When a per-pick max is set it replaces
  // the global cap (see getPickRejectionReason), so this entry is authoritative.
  // Backtest 2026-04-19 ndjson: [5.5–6.0] 4W/12L +43%, [6.0–7.0] 9W/12L +174%,
  // [7.0–8.0] 4W/10L +111% — all profitable. [8.0+] 0W/11L -100% — hard stop.
  // Raise cap from 5.50 to 7.99 to capture the 51 profitable blocked picks.
  'PL|ONE_X_TWO|DRAW': new Decimal('7.99'),
  // Backtest 2026-04-19 ndjson: PL AWAY [5.0–7.0] → 26W/66L +39.7% simROI (profitable),
  // [7.0–10.0] → 2W/24L -37.2% (structurally broken). Cap at 6.99 isolates the
  // profitable window; combined with probability threshold lowered to 0.30.
  'PL|ONE_X_TWO|AWAY': new Decimal('6.99'),
  // Backtest 2026-04-18: BL1 AWAY at [3.0-4.99] → 1W-6L, -54% ROI across 3 seasons.
  // AWAY at [2.0-2.99] was 2W-0L. Cap at 2.99 to eliminate the losing segment.
  'BL1|ONE_X_TWO|AWAY': new Decimal('2.99'),
  // D2 backtest 2026-04-19: both 4.99 and 3.70 extensions degraded the AWAY branch.
  // The only stable positive window remains 2.0-2.99; above 3.0 the branch turns
  // into a win/loss drag despite high model EV.
  'D2|ONE_X_TWO|AWAY': new Decimal('2.99'),
  // CH prod window 2026-04-24: recent AWAY losses cluster at 4.10, 4.98, 5.99, 6.05
  // while the current backtest's rare positive AWAY bets sit below 4.0. Keep only
  // the shorter outsider window and cut the long tail that drove the red dashboard.
  'CH|ONE_X_TWO|AWAY': new Decimal('3.99'),
  // POR backtest 2026-04-25: HOME odds split is decisive — ≤ 2.34 yields 3W/0L
  // (2.12, 2.20, 2.32) while 2.35-2.99 yields 1W/4L (2.35L, 2.37L, 2.48L, 2.86L,
  // 2.65W). Model is reliable only for heavy favorites (short-price home signal).
  'POR|ONE_X_TWO|HOME': new Decimal('2.34'),
  // POR ndjson 2026-04-19: profitable rejected DRAW candidates sit between 3.57
  // and 4.82, while the market is currently blocked by the global 4.0 cap. Set
  // a local 4.99 ceiling to admit the tested range without opening longshots.
  'POR|ONE_X_TWO|DRAW': new Decimal('4.99'),
  // L1 backtest 2026-04-19: 1X2 HOME at 3.0-4.99 went 0W/2L, while 2.0-2.99 was
  // the profitable core window (9W/15 in the latest 3-season run). Cap at 2.99.
  'L1|ONE_X_TWO|HOME': new Decimal('2.99'),
  // LL backtest 2026-04-24: HOME remains the only usable 1X2 direction, but the
  // cleanest edge is on short-priced favorites. <2.0 went 3W/3 (+87% ROI) while
  // 2.0-2.99 was effectively flat at 4W/9 (+0.9% ROI). Keep only the strong core.
  'LL|ONE_X_TWO|HOME': new Decimal('1.99'),
  // Backtest 2026-04-24 after adding a light 1X2 empirical blend: the clean F2
  // HOME edge concentrates in 2.0-2.49 (+16.5% ROI on 25 bets), while 2.5-2.99
  // slips slightly negative (4W/11, -3.2% ROI). Keep only the shorter home window.
  'F2|ONE_X_TWO|HOME': new Decimal('2.49'),
  // Audit 2026-04-25: ERD AWAY at 3.78 odds surfaced and lost; the Eredivisie
  // dominated-fixture profile means long-shot aways are pure noise. Keep only
  // the 2.0-2.99 window consistent with other leagues where AWAY signal is real.
  'ERD|ONE_X_TWO|AWAY': new Decimal('2.99'),
  // Audit 2026-04-25: MX1 HOME breakdown by odds range over 3 seasons:
  // [1.80-2.49] = 17 bets 9W/8L +20% ROI; [2.50-2.75] = 5 bets 1W/4L -47%;
  // [3.00+] = 2 bets 0W/2L -100%. Cut above 2.49 — same approach as F2 HOME.
  'MX1|ONE_X_TWO|HOME': new Decimal('2.49'),
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
