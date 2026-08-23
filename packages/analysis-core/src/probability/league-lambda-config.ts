// Per-league inputs to deriveLambdas (probability-level calibration — the
// raw Poisson core has no notion of "this league runs high/low-scoring" or
// "this league has more/less home advantage than the global default" beyond
// what xG already encodes; these maps correct for that, same category as
// OU_SHRINKAGE_CONFIG (ou-shrinkage.ts, sibling file) rather than a
// staking/decision knob.
// Moved 2026-08-19 from apps/backend/.../ev.constants.ts, where these had
// accumulated alongside genuinely VALUE-specific config (EV_THRESHOLD,
// PICK_EV_FLOOR_MAP) despite calibrating the shared probability every
// channel reads, not a staking decision.

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
  // TUR1: Süper Lig historical goal rate is lower than the global default 1.40.
  // Backtest 2026-04-30: 12 UNDER bets blocked by under_high_lambda (λ > 2.5)
  // went 9W/3L with an average of 2.33 actual goals — model overestimates scoring.
  // Anchor 1.25 pulls lambda toward the observed rate and raises P(UNDER), allowing
  // high-confidence UNDER picks to reach the EV threshold.
  TUR1: 1.25,
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
  // WC: WC 2022 and 2018 averaged 2.65–2.69 goals/game (λ ≈ 1.33/team). Cross-comp stats
  // (WCQAF/FRI friendlies used for teams without in-tournament data) inflate λ because
  // qualifying is more attacking than the tournament itself. Anchor at 1.3 pulls shrinkage
  // toward the observed tournament goal rate and prevents OVER_3_5/OVER picks from
  // receiving unrealistically high λ values when the primary stat source is friendlies.
  WC: 1.3,
};

const LEAGUE_MEAN_LAMBDA_DEFAULT = 1.4;

export function getLeagueMeanLambda(
  competitionCode: string | null | undefined,
): number {
  if (competitionCode != null && competitionCode in LEAGUE_MEAN_LAMBDA_MAP) {
    return LEAGUE_MEAN_LAMBDA_MAP[competitionCode]!;
  }
  return LEAGUE_MEAN_LAMBDA_DEFAULT;
}

// Home advantage correction applied to Poisson lambdas before probability
// computation. Academic literature (Dixon-Coles, Karlis-Ntzoufras) measures
// home advantage at 5-8%. Previously raised from 0.93→0.95 after audit
// 2026-03-22, which fixed 3 specific fixtures with extreme away-λ
// underestimation (Hertha 1.11→5, Alaves 0.76→4, Kiel 0.98→3) — a narrow
// fix for clamp-floor cases, not a global calibration check.
// Recalibrated 2026-07-19 via grid-search Brier/ECE backtest on 46 679
// historical fixtures (packages/db/scripts/backtest-home-advantage-calibration.ts):
// the 3-way Brier/ECE was minimized at homeAdvFactor=1.00, awayDisadvFactor=0.75
// (ECE HOME 0.040→0.020, ECE AWAY 0.053→0.016), confirmed non-overfit via a
// 70/30 chronological train/test split (same optimum on train-only, still
// beats the old factors out-of-sample). ROI-impact check on ONE_X_TWO VALUE
// simulation (packages/db/scripts/backtest-home-advantage-roi-impact.ts,
// EV>=0.08 only, no edge-floor gate): +0.78pp ROI, but AWAY-side picks that
// still clear the threshold remain net-negative post-recalibration — the
// edge-floor gate (getValueMinEdge, VALUE-only) stays the primary AWAY-side
// safeguard, this factor alone doesn't fully close that gap.
// No longer symmetric (1.00 × 0.75 = 0.75, not ≈1) — the prior symmetric
// design assumption didn't hold up against the full historical distribution.
export const HOME_ADVANTAGE_LAMBDA_FACTOR = 1.0;
export const AWAY_DISADVANTAGE_LAMBDA_FACTOR = 0.75;

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
    return LEAGUE_HOME_ADVANTAGE_MAP[competitionCode]!;
  }
  return [HOME_ADVANTAGE_LAMBDA_FACTOR, AWAY_DISADVANTAGE_LAMBDA_FACTOR];
}

// Per-league goal-LEVEL correction (chantier B, 2026-06-30). Multiplies both
// lambdas to fix a structural bias where the xG-shrinkage goal expectation is
// systematically too high (scale < 1) or too low (scale > 1) for a league.
// Derived by minimising the Over/Under-2.5 + BTTS Brier on the stored lambdas
// (35k matches) — a deterministic transform validated offline. Direction is
// stable across 3-4 seasons (over-predictors over-predict every season, etc.),
// so unlike ROI fits this is robust; magnitudes are kept conservative (capped
// ±0.10, gentler on the over-predictors whose bias softened in 2025-26).
// Weighted Brier gain +0.0058 over the original 11 leagues (2026-06-30);
// FIN1/BL1 added 2026-07-28 with their own validated per-league gains (see
// comments below) — not yet folded into this aggregate figure. Default 1.0
// elsewhere.
const LAMBDA_SCALE_MAP: Record<string, number> = {
  // Under-predict goals (scale up): -Δtot every season.
  MLS: 1.1, // -0.24/-0.17/-0.84
  TUR1: 1.1, // -0.22/-0.28/-0.18
  NOR1: 1.1, // -0.35/-0.09/-0.24/-0.46
  NOR2: 1.1, // -0.13/-0.19/-0.21
  SUI2: 1.1, // -0.17/-0.10/-0.24
  CSL: 1.1, // -0.29/-0.35
  ISL1: 1.1, // -0.47/-0.64 (capped from fitted 1.20; low data)
  SWE2: 1.05, // -0.14/-0.11/-0.18 (smaller bias)
  // FIN1: season-by-season gap +5.4%/+0.2%/+7.5%/+38.4% (2026 partial,
  // n=50) — stable, never negative, accelerating. No prior lambda
  // correction (OU_SHRINKAGE_CONFIG.FIN1.factor=1, a no-op on full-time
  // lines). Backtest 2026-07-28 (db:backtest:lambda-scale-calibration):
  // fitted 1.22 on OVER2.5+BTTS Brier, capped 1.10 (ISL1 precedent) →
  // validation Brier -0.0166 (n=443, real out-of-sample gain).
  FIN1: 1.1,
  // BL1: season-by-season gap +0.042/+0.071/+0.112 goals/match (2023-24 →
  // 2025-26), stable and growing DESPITE the existing meanLambda anchor
  // (LEAGUE_MEAN_LAMBDA_MAP.BL1=1.7) — the anchor alone no longer covers
  // the drift. Backtest 2026-07-28: fitted 1.14, capped 1.10 → validation
  // Brier -0.0105 (n=783).
  BL1: 1.1,
  // Over-predict goals (scale down): +Δtot every season, softened in 2025-26.
  SP2: 0.95, // +0.70/+0.01/+0.33 (variable → gentle)
  MX1: 0.95, // +0.54/+0.53/+0.06
  J1: 0.95, // +0.43/+0.14/+0.19/+0.09
};

export function getLeagueLambdaScale(
  competitionCode: string | null | undefined,
): number {
  if (competitionCode != null && competitionCode in LAMBDA_SCALE_MAP) {
    return LAMBDA_SCALE_MAP[competitionCode]!;
  }
  return 1;
}
