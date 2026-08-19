import Decimal from "decimal.js";
import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

// DOMINANT picks are rejected when the argmax outcome leads the 2nd-best by less
// than this margin — prevents "barely-DOMINANT" picks where all three outcomes
// cluster near 33% (model has no real conviction).
export const DOMINANT_MIN_MARGIN = new Decimal("0.05");

// DOMINANT has no upper odds bound (unlike SAFE) but does need a floor: below
// this, the pick is a near-certain heavy favorite with a trivial payout —
// backtest 2026-07-20 shows the <1.20 bucket is DOMINANT's best-performing
// (89% hit rate, +1.23% ROI), so this isn't about accuracy, it's volume — the
// World Cup group stage flooded the feed with these low-value picks. Applied
// only when the book has a price; a price-less selection still passes through
// for analytical settlement.
export const DOMINANT_MIN_ODDS = new Decimal("1.20");

export const DOMINANT_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 50,
};

export const DOMINANT_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  // Tuning 2026-07-09: HR-only, ROI unproven — 0.65 gives 51.1% HR
  // (n=94/1227, cov 7.7%, ROI +8.6% on the thin priced subset).
  ARG1: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // Result-derived 2026-07-09: low-scoring, tight league. 0.55 gives
  // 50.3% HR (n=322/2314, cov 14%) — modest signal, above the 33%
  // 3-outcome baseline. Monitor closely.
  ARG2: { enabled: true, threshold: 0.55, minSampleN: 15 },
  // Tuning 2026-07-09: HR-only, ROI unproven — 0.65 gives 56.5% HR
  // (n=69/501, cov 14%, ROI -9.8% on the thin priced subset). Enabled to
  // observe; HR climbs with threshold while ROI stays flat-negative,
  // suggesting the priced subset (not the model) is the noisy part.
  AUT1: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // Tuning 2026-07-09: DOMINANT validates at 0.65 (ROI +1.3%, n=110, cov 14%).
  BEL1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // BL1 backtest 2026-04-19: 0.50 keeps validation while materially
  // improving coverage versus 0.60 (40.7% vs 14.1%).
  // Tuning 2026-06-24 (1y): 0.50 → 0.55 (ROI +4.3%, n=76, cov 31%).
  BL1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // BRA1 backtest 2026-05-24: DOMINANT validates at 0.55 (60.6% HR, 175 predictions).
  BRA1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // Tuning 2026-07-09: DOMINANT validates strongly at 0.6 (ROI +25.7%,
  // n=131, cov 12%).
  BRA2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // CH backtest 2026-04-19: 0.60 now validates and supports reactivation.
  CH: { enabled: true, threshold: 0.6, minSampleN: 20 },
  // Tuning 2026-07-09: DOMINANT validates at 0.65 (ROI +11.4%, n=54, cov 10%).
  CHI1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // Result-derived 2026-07-09: 0.65 gives 56.9% HR (n=65/569, cov 11%).
  CHI2: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // Result-derived 2026-07-09: 0.6 gives 58.4% HR (n=149/791, cov 19%).
  CHN2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // CSL backtest 2026-05-24: DOMINANT exceptional — 0.60 gives 70% HR on 167 preds,
  // 0.65 gives 79% HR on 103 preds. Use 0.60 for volume + precision balance.
  CSL: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // CZE1 backtest 2026-05-03: DOMINANT strong at 0.55 (65.4%, 34.4%, 228 picks).
  CZE1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // D2 backtest 2026-04-19: no tested threshold clears the prediction
  // hit-rate floor, so disable pending future recalibration.
  D2: { enabled: false, threshold: 0.55, minSampleN: 10 },
  // Tuning 2026-07-09: DOMINANT validates at 0.75 (ROI +12.6%, n=25, cov 5%).
  // Thin single-window sample — minSampleN raised to 15.
  DEN1: { enabled: true, threshold: 0.75, minSampleN: 15 },
  // EL1 backtest 2026-04-19: 0.65 is too strict on coverage; 0.55 restores
  // a valid sample size while staying above the hit-rate floor.
  EL1: { enabled: true, threshold: 0.55, minSampleN: 20 },
  // EL2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
  EL2: { enabled: false, threshold: 0.55, minSampleN: 15 },
  // Tuning 2026-06-24 (1y): no viable threshold (ROI -10.1%, n=143 at 0.50)
  // → suspend pending recalibration.
  ERD: { enabled: false, threshold: 0.5, minSampleN: 10 },
  // Result-derived 2026-07-09: 0.65 gives 74.5% HR (n=149/527, cov 28%) — excellent.
  EST1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // F2 backtest 2026-05-03: 0.55 validates at 58% hit rate on 112 picks
  // (13.4% coverage). Narrow window — 0.50 and 0.60 both fail. minSampleN
  // raised to 15 for robustness given the single-threshold pass.
  F2: { enabled: true, threshold: 0.55, minSampleN: 15 },
  // FIN1 backtest 2026-05-24: DOMINANT validates at 0.55 (65% HR, 52 preds). Prefer 0.55
  // over 0.50 for precision (65% vs 60%).
  // Tuning 2026-06-24 (1y): 0.55 → 0.45 (ROI +16.4%, n=73, cov 76%) — more volume, stronger ROI.
  FIN1: { enabled: true, threshold: 0.45, minSampleN: 10 },
  // Result-derived 2026-07-09: 0.6 gives 58.6% HR (n=99/320, cov 31%).
  FIN2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // FRI backtest 2026-05-03: only 44 fixtures total — no signal derivable.
  FRI: { enabled: false, threshold: 0.99, minSampleN: 50 },
  // Tuning 2026-07-09: HR-only, ROI unproven — hit rate climbs cleanly
  // with threshold (53.9% → 75.5% from 0.45 to 0.75) but ROI stays
  // negative throughout on the thin priced subset. 0.65 balances HR
  // (68.3%) against coverage (n=120/614, 19.5%). Enabled to observe —
  // the consistent negative ROI is itself a signal worth tracking
  // forward, not a reason to go dark on this league.
  GRE1: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // I2 backtest 2026-04-19: no tested threshold clears the hit-rate floor.
  I2: { enabled: false, threshold: 0.55, minSampleN: 10 },
  // Tuning 2026-07-09: HR-only, ROI unproven — 0.65 gives 62.7% HR
  // (n=67/568, cov 12%, ROI -9.2% on the thin priced subset). Enabled to
  // observe; HR climbs cleanly with threshold (51% → 68.4%) while ROI
  // stays flat-negative, suggesting the priced subset (not the model
  // ranking) is the noisy part.
  IRL1: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // Result-derived 2026-07-09: 0.65 gives 65.7% HR (n=108/497, cov 22%).
  ISL1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // J1 backtest 2026-05-03: DOMINANT never cleared 50% hit rate floor.
  // Tuning 2026-06-24 (1y): DOMINANT validates at 0.45 (ROI +10.3%, n=124, cov 59%).
  J1: { enabled: true, threshold: 0.45, minSampleN: 10 },
  // KOR1: DOMINANT no PASS threshold found.
  KOR1: { enabled: false, threshold: 0.99, minSampleN: 10 },
  // Result-derived 2026-07-09: 0.6 gives 54.7% HR (n=139/845, cov 16%).
  KOR2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // Tuning 2026-07-09: DOMINANT validates at 0.65 (100% hit rate, ROI
  // +24.7%, n=24, cov 35%). Very thin sample (68 candidates total) —
  // minSampleN raised to 20, monitor closely before trusting the 100% HR.
  KSA1: { enabled: true, threshold: 0.65, minSampleN: 20 },
  // L1 backtest 2026-05-03: never configured — fell to defaults. Strong
  // progressive scan: 0.60 gives 66% hit rate (16% coverage, 122 picks).
  L1: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // Result-derived 2026-07-09: 0.65 gives 77.7% HR (n=197/560, cov 35%) — excellent.
  LAT1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // LL backtest 2026-04-19: 0.50 keeps validation while materially
  // expanding coverage versus 0.60.
  LL: { enabled: true, threshold: 0.5, minSampleN: 20 },
  // MX1 backtest 2026-05-03: DOMINANT validates at 0.55 (61.5%, 23.3% coverage).
  MX1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // NOR1 backtest 2026-05-03: DOMINANT validated at 0.55 (61%, 34.7%, 205 picks).
  // Tuning 2026-06-24 (1y): no viable threshold (ROI -17.7%, n=61 at 0.55)
  // → suspend pending recalibration.
  NOR1: { enabled: false, threshold: 0.55, minSampleN: 10 },
  // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.5 validates
  // (ROI +30.1%, n=37, cov 73%) — supersedes the 2026-07-09 result-only
  // estimate (0.65) now that real ROI data exists.
  NOR2: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // PL backtest 2026-05-02: DOMINANT remains validated at 0.55.
  PL: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // Result-derived 2026-07-09: 0.6 gives 57.7% HR (n=213/897, cov 24%).
  POL2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // Tuning 2026-06-24 (1y): 0.50 → 0.55 (ROI +1.5%, n=97, cov 36%).
  POR: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // Tuning 2026-07-09: DOMINANT validates at 0.65 (ROI +5.2%, n=33, cov 18%).
  // Marginal ROI over a thin sample — minSampleN raised to 15.
  RUS1: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // SA backtest 2026-05-03: DOMINANT activated at 0.50 (65.4% hit rate, 335 picks).
  // Tuning 2026-06-24 (1y): no viable threshold (ROI -8.1%, n=122 at 0.50)
  // → suspend pending recalibration.
  SA: { enabled: false, threshold: 0.5, minSampleN: 10 },
  // Tuning 2026-07-09: DOMINANT validates at 0.7 (ROI +10.5%, n=80, cov 13%).
  SCO1: { enabled: true, threshold: 0.7, minSampleN: 10 },
  // SP2 backtest 2026-05-02: 0.55 remains the best DOMINANT balance.
  SP2: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // SRB1 backtest 2026-05-03: DOMINANT validates at 0.55 (63.1%, 30.3%, 217 picks).
  SRB1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // SUI1 backtest 2026-05-03: DOMINANT validates only at 0.60 (55.4%, 14.8%, 83 picks).
  // Fragile single-window — minSampleN raised to 15.
  SUI1: { enabled: true, threshold: 0.6, minSampleN: 15 },
  // Result-derived 2026-07-09: 0.65 gives 64.7% HR (n=85/522, cov 16%).
  SUI2: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // Result-derived 2026-07-09: 0.65 gives 66.3% HR (n=104/504, cov 21%).
  SVN1: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // SWE1 backtest 2026-05-03: DOMINANT validates at 0.55 (58.5%, 32.5%, 195 picks).
  SWE1: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // Result-derived 2026-07-09 (2026-05-03 backtest found no PASS threshold
  // for DOMINANT — but that was ROI-gated on thin priced odds; DOMINANT
  // settles on the match result alone). 0.65 gives 60.9% HR (n=92/751,
  // cov 12%). Enabled to observe rather than left disabled.
  SWE2: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // TUR1 backtest 2026-05-03: DOMINANT strong progressive signal — 0.55 gives 67.5% hr
  // with 29.6% coverage (252 picks). Clear favourite league.
  // Tuning 2026-06-24 (1y): 0.55 → 0.60 (ROI +6.5%, n=54, cov 30%) — tighter, cleaner.
  // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.60 → 0.70
  // (ROI +13.3%, n=77, cov 11%) — tighter still, cleaner ROI.
  TUR1: { enabled: true, threshold: 0.7, minSampleN: 10 },
  // TUR2 backtest 2026-05-03: DOMINANT extraordinarily strong — 0.60 gives 73.9% hr with
  // 23.3% coverage (211 picks). Chosen over 0.65/0.70 for robustness.
  TUR2: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // UCL backtest 2026-05-03: DOMINANT validated cleanly at 0.55 (59.7%, 28.1% coverage, 159 picks).
  // Tuning 2026-06-24 (1y): 0.55 → 0.45 (ROI +18.7%, n=53, cov 68%).
  UCL: { enabled: true, threshold: 0.45, minSampleN: 10 },
  // UECL backtest 2026-05-03: DOMINANT strong — 0.60 gives 62.2% hr with 22.6% coverage (135 picks).
  UECL: { enabled: true, threshold: 0.6, minSampleN: 10 },
  // UEL backtest 2026-05-03: DOMINANT validated only at 0.65 (57.6%, 10% coverage, 66 picks).
  // Tuning 2026-06-24 (1y): 0.65 → 0.45 (ROI +11.6%, n=79, cov 64%) — broader, stronger window.
  UEL: { enabled: true, threshold: 0.45, minSampleN: 20 },
  // UNL backtest 2026-05-03: DOMINANT never clears 55% hit rate floor. Keep disabled.
  UNL: { enabled: false, threshold: 0.99, minSampleN: 50 },
  // Result-derived 2026-07-09: weak signal — 0.65 gives 53.6% HR
  // (n=125/1338, cov 9%). Monitor closely.
  USA2: { enabled: true, threshold: 0.65, minSampleN: 15 },
  // WC recalibration 2026-07-01 on WC 2026 forward data (group stage + 7 R32 =
  // 79 fixtures played; WC 2022 produced no settled picks — no odds imported —
  // so this is single-tournament, in-progress: only structural + data-confirmed
  // moves, no ROI-fit to variance).
  // DOMINANT: 0.60 is break-even in the 48-team format (33 picks 66.7% HR, ROI
  // -0.7%); 0.65 drops the weak 0.60-0.65 band (4W/5L) → 24 picks 75.0% HR,
  // +10.7% ROI. Raise to 0.65 — consistent with every WCQ config (the expanded
  // 48-team format is more competitive, so DOMINANT needs a higher bar).
  WC: { enabled: true, threshold: 0.65, minSampleN: 10 },
  // WCQAF backtest 2026-06-02 (2023-24 season, 92 fixtures — most recent available).
  // 0.55 validates strongly: 26 picks, 80.8% HR, 28.3% coverage.
  // 2022-23 showed weak signal (11 picks at 0.50). 2023-24 is more reliable reference.
  WCQAF: { enabled: true, threshold: 0.55, minSampleN: 10 },
  // WCQAS backtest 2026-06-02 (2026-27 season, 226 fixtures).
  // 0.75 is the lowest threshold that passes in 2026-27: 26 picks, 65.4%, 11.5% coverage.
  // 2022-23 showed extraordinary signal (84%+ HR from 0.50 upward) but 2026-27 expanded
  // format weakened it significantly — 0.75 is the conservative cross-season choice.
  // DRAW: 2026-27 at 0.28 ROI +13.4% (PASS) but 2022-23 doesn't validate. Monitor.
  WCQAS: { enabled: true, threshold: 0.75, minSampleN: 10 },
  // WCQCA backtest 2026-06-02 (2026-27 season, 100 fixtures).
  // 0.75 clears 55% floor in 2026-27: 43 picks, 60.5% HR, 44.8% coverage.
  // 2022-23 showed stronger signal at lower thresholds but WC 2026 expanded format
  // (48 teams) makes qualifs more competitive — use recent season as reference.
  WCQCA: { enabled: true, threshold: 0.75, minSampleN: 10 },
  // WCQE backtest 2026-05-03: DOMINANT strong at 0.50 (70.8%, 66 fixtures — lopsided matchups).
  WCQE: { enabled: true, threshold: 0.5, minSampleN: 10 },
  // WCQSA backtest 2026-06-02 (2026-27 season, 90 fixtures).
  // 0.60 validates in both seasons: 2022-23 78.9%/19 picks, 2026-27 57.1%/21 picks.
  WCQSA: { enabled: true, threshold: 0.6, minSampleN: 10 },
};
