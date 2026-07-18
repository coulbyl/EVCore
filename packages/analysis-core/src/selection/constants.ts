import Decimal from "decimal.js";

// Fixed algorithm constants for pick selection / validation.
//
// These are the model's intrinsic parameters — anomaly caps, longshot penalties,
// probability floors, safe-value windows — not league/env tuning. League- and
// market-specific overrides stay app-side and reach the core via SelectionConfig.
//
// NOTE: the canonical EV threshold (≥ 0.08) deliberately stays in app config
// (per spec, never hardcoded in the core) and is injected as a value.

// EV hard cap — reject any pick with EV above this value.
// An EV > 0.90 is implausible against a sharp market (Pinnacle) and
// invariably reflects a lambda or xG estimation error (audit 2026-03-22:
// Burgos EV=0.942 lost 4-0, confirming the anomaly signal).
export const EV_HARD_CAP = new Decimal("0.90");

// Minimum probability for any pick on the EV channel.
// Picks with P < 40% are statistically unlikely and empirically losing even when
// the Poisson EV is positive (model overestimates P on edge cases).
// May 2026 live diagnostic: 3 losses at P=32.6%, 34.4%, 46.8% on EV channel.
export const EV_MIN_PROBABILITY_THRESHOLD = new Decimal("0.40");

// Minimum quality score (EV × deterministicScore × longshotPenalty) required
// for a pick to be selected, given that the fixture already passed
// MODEL_SCORE_THRESHOLD. At score=0.60, requires EV >= 0.10 to pass.
export const MIN_QUALITY_SCORE = new Decimal("0.06");

// Minimum qualityScore for a fallback EV pick (applied when the primary best
// pick was rejected). Prevents selecting a poor substitute just because it is
// the "best remaining" after rejection of the dominant candidate.
export const FALLBACK_MIN_QUALITY_SCORE = new Decimal("0.09");

// Global maximum selection odds — kept as a hard ceiling across all leagues.
// Eliminates long shots where probability overestimation inflates EV.
export const MAX_SELECTION_ODDS = new Decimal("4.0");

// Under 2.5 bets at high expected-goal totals are systematically losing — the
// independent Poisson model overestimates P(Under) due to real-match overdispersion.
// When λ_home + λ_away exceeds this threshold, reject UNDER outright regardless of EV.
// Lowered from 2.5 → 2.3 (May 2026 live diagnostic: losses at λ 2.30–2.80 confirmed).
export const UNDER_HIGH_LAMBDA_THRESHOLD = 2.3;

// 1X2 longshot penalty — progressively dampens the quality score of AWAY/DRAW
// picks at long odds, where probability overestimation inflates EV.
export const ONE_X_TWO_AWAY_MAX_ODDS = new Decimal("5.0");
export const ONE_X_TWO_DRAW_MAX_ODDS = new Decimal("6.0");
export const ONE_X_TWO_AWAY_LONGSHOT_PENALTY_FLOOR = new Decimal("0.12");
export const ONE_X_TWO_DRAW_LONGSHOT_PENALTY_FLOOR = new Decimal("0.20");
export const ONE_X_TWO_LONGSHOT_PENALTY_EXPONENT = 2;

// Minimum model edge (probability − 1/odds) for a VALUE pick. The EV gate alone
// is not enough: EV = odds × edge, so an EV floor lets high-odds picks through on
// a tiny (fake) edge while over-penalising low-odds ones. Settled-pick analysis
// (2026-07-01, ~1176 VALUE picks across leagues) shows the model is systematically
// ~8pp overconfident, so its actual hit rate tracks the BOOK implied probability,
// not its own. Picks split cleanly on edge: below 0.10 the claimed edge is entirely
// absorbed by overconfidence → breakeven/negative (edge <0.05 → −24% ROI, 0.05–0.10
// → +0.8%); at edge ≥ 0.10 a real edge survives (+16.8% at 0.10–0.15, +24.5% ≥0.22).
// This is a VALUE-only gate — SAFE lives on high-confidence small edges by design.
export const VALUE_MIN_EDGE = new Decimal("0.10");

// Minimum EV for safe value bets. Near-zero EV picks (< 0.05) show no reliable
// edge with the Poisson model — backtest 2026-04-13 shows OVER_1_5 at EV 0.004–0.039
// losing more often than the probability estimate predicts.
export const SAFE_VALUE_MIN_EV = new Decimal("0.05");

// Safe-value odds ceiling — caps mid-range picks where bookmaker margin erodes
// expected value disproportionately.
export const SAFE_VALUE_MAX_ODDS = new Decimal("2.20");

// When the SV winner is Under 3.5 or Under 4.5 and λ_total ≥ this threshold,
// the engine also evaluates Over 2.5 and Over 3.5 and selects the better
// qualityScore — fixing the structural Under bias at high expected goals.
export const SV_UNDER_LAMBDA_COMPARISON_THRESHOLD = 3.0;

// A line movement above this fraction triggers the VALUE channel to skip the
// fixture — price signal is unreliable when the market has already corrected.
export const LINE_MOVEMENT_THRESHOLD = new Decimal("0.10");
