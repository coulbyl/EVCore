import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

export const BTTS_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

// BTTS answers one question — will both teams score, yes or no — so it takes
// ONE config per league, evaluated symmetrically against both bttsYes and
// bttsNo, argmax picks whichever side clears the threshold with the higher
// probability (same pattern as CLEAN_SHEET/WIN_TO_NIL/WIN_EITHER_HALF's
// argmax(HOME, AWAY) over a single shared threshold — see decideBtts).
//
// 2026-08-19: retired the separate BTTS_NO_CONFIG/getBttsNoConfig split that
// had grown up beside this table (a second, lower-trust config for the NO
// side, structurally derived rather than backtested, "observation only,
// never staked"). That split let YES and NO drift into two different
// calibration methodologies for what is structurally one binary market —
// the same mistake the CLEAN_SHEET/WIN_TO_NIL pattern above deliberately
// avoids. The thresholds below (backtested for YES) now apply to NO too;
// re-deriving them with NO's own hit-rate history is deferred to the
// broader staking-policy pass (ROI-based promotion doesn't fit an
// independent-legs coupon model either — see TODO.md).
export const BTTS_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  // Result-derived 2026-07-09 (no priced BTTS odds): base BTTS-yes rate
  // 0.40 (low-scoring league). 0.50 gives 40.8% HR (n=120/1463, cov 8.2%)
  // — barely above base rate, weak signal. Enabled to observe.
  ARG1: { enabled: true, threshold: 0.5, minSampleN: 15 },
  // Weak BTTS signal (low-scoring league) — 0.52 gives 57.6% HR
  // (n=66/2314, cov 2.9%). Thin — minSampleN raised to 15.
  ARG2: { enabled: true, threshold: 0.52, minSampleN: 15 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.58 gives 53.1% HR
  // (n=49/567, cov 8.6%). Thin — minSampleN raised to 15.
  AUT1: { enabled: true, threshold: 0.58, minSampleN: 15 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 61.9% HR
  // (n=236/923, cov 26%) — solid coverage and hit rate.
  BEL1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // BL1 backtest 2026-05-03: 0.56 covered 83% of fixtures — too broad.
  // 0.60 keeps 65% hit rate with 45% coverage, a meaningful selector.
  // Tuning 2026-06-24 (1y): 0.60 → 0.62 (ROI +2.1%, n=93, cov 31%).
  BL1: { enabled: true, threshold: 0.62, minSampleN: 10 },
  // BRA1 backtest 2026-05-24: BTTS prediction — no threshold validates.
  BRA1: { enabled: false, threshold: 0.99, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): weak signal overall
  // (base rate 0.45); 0.52 gives 49.5% HR (n=105/1283, cov 8.3%). Thin —
  // minSampleN raised to 15, monitor closely.
  BRA2: { enabled: true, threshold: 0.52, minSampleN: 15 },
  // CH backtest 2026-05-03: BTTS validates at 0.50 and 0.52 only — window
  // closes at 0.55 (coverage drops). 0.52 preferred for selectivity.
  CH: { enabled: true, threshold: 0.52, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 57.6% HR
  // (n=205/805, cov 25.5%) — good coverage and hit rate.
  CHI1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // 0.5 gives 52.2% HR (n=255/569, cov 45%) — good coverage.
  CHI2: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // 0.52 gives 60.9% HR (n=179/791, cov 23%).
  CHN2: { enabled: true, threshold: 0.52, minSampleN: 10 },
  // CSL backtest 2026-05-24: BTTS 0.62 gives 74% HR on 68 preds — excellent precision.
  CSL: { enabled: true, threshold: 0.62, minSampleN: 10 },
  // CZE1 backtest 2026-05-03: BTTS validates only at 0.50 and 0.52; above 0.55 FAIL.
  // 0.52 preferred for selectivity (56%, 38% coverage, 252 picks).
  CZE1: { enabled: true, threshold: 0.52, minSampleN: 10 },
  // D2 backtest 2026-05-03: BTTS signal validates across all thresholds.
  // 0.60 gives 63% hit rate with 33% coverage — best balance for D2.
  D2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): highest-scoring
  // league in this batch (base rate 0.61). 0.6 gives 65.4% HR (n=104/561,
  // cov 18.5%).
  DEN1: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // EL1 backtest 2026-05-03: 0.58 is the only valid BTTS threshold (55.6%,
  // 196 picks). Fragile single-window — monitor each season.
  // Tuning 2026-06-24 (1y): 0.58 → 0.60 (ROI +2.3%, n=64, cov 12%).
  EL1: { enabled: true, threshold: 0.6, minSampleN: 15 },
  // EL2 backtest 2026-05-03: BTTS validates at 0.58 (57.8%) and 0.60 (59%).
  // 0.60 preferred for better precision (11% coverage, 161 picks).
  EL2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  ERD: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // 0.5 gives 54.9% HR (n=266/527, cov 50%).
  EST1: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // Tuning 2026-06-24 (1y): enable BTTS at 0.50 (ROI +1.4%, n=54, cov 93%).
  F2: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // FIN1 backtest 2026-05-24: BTTS validates at 0.55 (62% HR, 68 preds).
  FIN1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // 0.58 gives 69.9% HR (n=103/320, cov 32%) — excellent.
  FIN2: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.58 gives 58.7% HR
  // (n=46/688, cov 6.7%). Thin — minSampleN raised to 15.
  GRE1: { enabled: true, threshold: 0.58, minSampleN: 15 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 52.1% HR
  // (n=73/648, cov 11.5%). Modest — minSampleN raised to 15.
  IRL1: { enabled: true, threshold: 0.55, minSampleN: 15 },
  // Very high-BTTS league (base rate ~67%+). 0.58 gives 69.0% HR
  // (n=348/497, cov 70%) — strong balance of HR and coverage.
  ISL1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // J1 backtest 2026-05-03: BTTS validates at 0.58 (56%, 26.9% coverage,
  // 268 picks) — best balance for the league.
  J1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // KOR1 backtest 2026-05-24: BTTS 58.5% HR on 82 preds at 0.55.
  KOR1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // 0.55 gives 56.6% HR (n=182/845, cov 22%).
  KOR2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.6 gives 61.3% HR
  // (n=93/891, cov 10.4%).
  KSA1: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // L1 backtest 2026-05-03: low-BTTS league, 0.58 was the lowest valid
  // threshold (55.4%, 157 picks). Fragile — minSampleN raised to 15.
  // Tuning 2026-06-24 (1y): no viable threshold (ROI -12.2%, n=73 at 0.58)
  // → suspend pending recalibration.
  L1: { enabled: false, threshold: 0.58, minSampleN: 15 },
  // 0.55 gives 59.7% HR (n=119/560, cov 21%).
  LAT1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // LL backtest 2026-05-03: 0.57 produced only 58 picks (6.2% coverage, FAIL).
  // 0.55 keeps the same 62.1% hit rate with 158 picks and 17% coverage (PASS).
  // Tuning 2026-06-24 (1y): 0.55 → 0.50 (ROI +7.2%, n=246, cov 67%).
  LL: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // MLS backtest 2026-05-03: DOMINANT no PASS. BTTS high-BTTS league — coverage collapses
  // above 0.62. 0.62 gives 65.5% hr with 19.1% coverage (174 picks).
  MLS: { enabled: true, threshold: 0.62, minSampleN: 10 },
  // MX1 backtest 2026-05-03: BTTS high-BTTS league, coverage collapses above 0.65.
  // 0.65 gives 60.2% hit rate with 30.2% coverage — best balance (259 picks).
  MX1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // NOR1 backtest 2026-05-03: BTTS 0.62 gives 67.1% hr with 11.8% coverage (70 picks).
  NOR1: { enabled: true, threshold: 0.62, minSampleN: 10 },
  // 0.6 gives 62.6% HR (n=423/779, cov 54%) — high-BTTS league.
  NOR2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // PL backtest 2026-05-03: 0.58 improves hit rate to 64.1% (vs 60.6% at
  // 0.55) while keeping 36% coverage — cleaner signal on a high-volume ligue.
  // Tuning 2026-06-24 (1y): 0.58 → 0.52 (ROI +0.8%, n=276, cov 75%).
  PL: { enabled: true, threshold: 0.52, minSampleN: 10 },
  // POL1 backtest 2026-05-03: DOMINANT no PASS. BTTS validates progressively;
  // 0.58 gives 62.6% hr with 16.8% coverage (123 picks) — better precision than 0.50.
  POL1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // 0.55 gives 62.5% HR (n=240/897, cov 27%).
  POL2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.55 gives 64.2% HR
  // (n=137/702, cov 19.5%) — solid.
  RUS1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // SA backtest 2026-05-03: 0.58 produced only 3 picks (INSUFFICIENT_DATA).
  // Serie A is a low-BTTS league; 0.52 is the only valid threshold
  // (60% hit rate, 115 picks, 12% coverage).
  SA: { enabled: true, threshold: 0.52, minSampleN: 10 },
  // Result-derived 2026-07-09 (no priced BTTS odds): 0.58 gives 64.6% HR
  // (n=96/678, cov 14.2%) — best balance of HR and coverage (0.6 gives
  // 74% but drops to n=50).
  SCO1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // SP2 backtest 2026-05-02: BTTS validates once calibrated independently
  // from the EV pick pipeline.
  SP2: { enabled: true, threshold: 0.58, minSampleN: 20 },
  // SRB1 backtest 2026-05-03: BTTS 0.58 gives 57.8% hr with 12.6% coverage (90 picks).
  SRB1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // SUI1 backtest 2026-05-03: BTTS 0.60 gives 60.6% hr with 22.6% coverage (127 picks).
  SUI1: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // High-BTTS league (base rate ~87% coverage at 0.5). 0.6 gives 58.8% HR
  // (n=216/522, cov 41%) — good balance.
  SUI2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // 0.58 gives 58.3% HR (n=96/504, cov 19%).
  SVN1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // SWE1 backtest 2026-05-03: BTTS 0.58 gives 60.6% hr with 17.3% coverage (104 picks).
  // Preferred over 0.55 for precision.
  SWE1: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // SWE2 backtest 2026-05-03: BTTS marginal at 0.55 (56.2%, 32%, 192 picks)
  // — passes criteria, monitor closely.
  SWE2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // BTTS 0.52 gives 56.5% HR (n=609/997, cov 61%) — strong volume+HR.
  TUR1: { enabled: true, threshold: 0.52, minSampleN: 10 },
  // BTTS weaker than DOMINANT here — 0.58 gives 56.1% HR (n=66/1052,
  // cov 6.3%). Thin — minSampleN raised to 15.
  TUR2: { enabled: true, threshold: 0.58, minSampleN: 15 },
  // UCL backtest 2026-05-03: BTTS validates at 0.60 (58.7%, 22.3% coverage, 126 picks).
  UCL: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // UECL backtest 2026-05-03: BTTS never clears 55% hit rate — all thresholds FAIL. Keep disabled.
  UECL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  // UEL backtest 2026-05-03: BTTS validates at 0.60 (62.8% hr, 86 picks, 13.1% coverage).
  // 0.58 also passes (55.9%) but 0.60 is cleaner.
  UEL: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // UNL backtest 2026-05-03: BTTS validates at 0.55 (62.2%, 37 picks, 68.5% coverage).
  UNL: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // 0.58 gives 55.6% HR (n=169/1338, cov 13%).
  USA2: { enabled: true, threshold: 0.58, minSampleN: 10 },
  // BTTS (observation only): 0.35 was an explicit data-collection placeholder
  // ("will fire on ~58% of fixtures ... data collection only"). Forward data now
  // supports a real conviction gate: at 0.50, 40 picks 62.5% HR (+21.9% ROI),
  // stable across 0.45-0.55. Promote 0.35 → 0.50 so the channel emits a genuine
  // signal instead of noise. minSampleN raised 5 → 10 now that volume exists.
  WC: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // WCQE backtest 2026-05-03: BTTS validates at 0.50 (64.1%, 39 picks). Small sample but clean.
  WCQE: { enabled: true, threshold: 0.5, minSampleN: 10 },
};
