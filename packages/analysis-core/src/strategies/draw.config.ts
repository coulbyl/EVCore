import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";

export const DRAW_DEFAULT: ChannelStrategyLeagueConfig = {
  enabled: false,
  threshold: 0.99,
  minSampleN: 20,
};

export const DRAW_CONFIG: Record<string, ChannelStrategyLeagueConfig> = {
  // Tuning 2026-07-09: 0.30 gives 34.8% HR (n=1147/1463, cov 78%,
  // ROI +3.8% on the thin priced subset).
  ARG1: { enabled: true, threshold: 0.3, minSampleN: 10 },
  // 0.28 gives 33.6% HR (n=1534/2314, cov 66%) — good coverage.
  ARG2: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // Tuning 2026-07-09: DRAW validates at 0.32 (ROI +25.3%, n=41, cov 7.2%).
  // Thin single-window sample — minSampleN raised to 15.
  AUT1: { enabled: true, threshold: 0.32, minSampleN: 15 },
  // Tuning 2026-07-09: DRAW validates at 0.32 (ROI +65.2%, n=26, cov 2.9%).
  // Very thin sample — minSampleN raised to 15, monitor closely.
  BEL1: { enabled: true, threshold: 0.32, minSampleN: 15 },
  // BL1 backtest 2026-05-05: strongest DRAW signal after I2. All 3 seasons
  // PASS: 2023-24 +17.8%, 2024-25 +14.1%, 2025-26 +33.4%. Aggregate
  // (186 picks, ~62/s): HR 35.5%, ROI +21.4%. threshold 0.28 = 1/3.57.
  BL1: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // BRA1 backtest 2026-05-24: DRAW ROI +20.7% on 29 predictions at 0.34. Marginal
  // sample — monitor closely.
  BRA1: { enabled: true, threshold: 0.34, minSampleN: 10 },
  // Tuning 2026-07-09: HR-only, ROI unproven — ROI negative at every
  // threshold on the thin priced subset, but 0.30 is the least-bad point
  // with real coverage (30.0% HR, n=869/1248, cov 70%). Enabled to
  // observe; ROI signal here (not just thin sampling) may confirm a real
  // DRAW weakness in this league once forward data accumulates.
  BRA2: { enabled: true, threshold: 0.3, minSampleN: 15 },
  // Tuning 2026-07-09: HR-only, ROI unproven — ROI negative at every
  // threshold on the thin priced subset; 0.30 is the least-bad point with
  // usable coverage (26.8% HR, n=127/607, cov 21%). Enabled to observe.
  CHI1: { enabled: true, threshold: 0.3, minSampleN: 15 },
  // 0.30 spikes to 41.5% HR but is thin (n=41/569, cov 7%) — used anyway,
  // minSampleN raised to 15 to gate it further.
  CHI2: { enabled: true, threshold: 0.3, minSampleN: 15 },
  // 0.28 gives 35.5% HR (n=234/791, cov 30%).
  CHN2: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // CSL backtest 2026-05-24: DRAW ROI +18% on 80 preds at 0.28.
  CSL: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): 0.26
  // gives 29.4% HR (n=265/789, cov 34%).
  CZE1: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // Tuning 2026-07-09: DRAW validates at 0.3 (ROI +11.3%, n=40, cov 7.1%).
  DEN1: { enabled: true, threshold: 0.3, minSampleN: 15 },
  // Weak signal — 0.24 is the best-covered point (22.7% HR, n=225/527,
  // cov 43%). Monitor closely.
  EST1: { enabled: true, threshold: 0.24, minSampleN: 15 },
  // Tuning 2026-06-24 (1y): enable DRAW at 0.32 (ROI +15.0%, n=84, cov 28%).
  F2: { enabled: true, threshold: 0.32, minSampleN: 10 },
  // FIN1 backtest 2026-05-24: DRAW ROI +6.9% on 21 preds at 0.30. Marginal — monitor.
  FIN1: { enabled: true, threshold: 0.3, minSampleN: 10 },
  // Weak signal — 0.24 is the best-covered point (23.9% HR, n=138/320,
  // cov 43%). Monitor closely.
  FIN2: { enabled: true, threshold: 0.24, minSampleN: 15 },
  // Tuning 2026-06-24 (1y): enable DRAW at 0.26 (ROI +38.9%, n=79, cov 51%).
  FRI: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // Tuning 2026-07-09: 0.26 gives the best ROI on the priced subset
  // (32.0% HR, n=412/674, cov 61%, ROI +3.6%).
  GRE1: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // I2 backtest 2026-05-05: strongest DRAW signal in the panel.
  // Aggregate 3 seasons (672 picks): HR 36.3%, ROI +11.1% at 0.30.
  // Consistent: 2023-24 +16.4%, 2024-25 +12.3%, 2025-26 +6.5%.
  // threshold 0.30 = 1/3.33 → selects drawOdds < 3.33.
  // Tuning 2026-06-24 (1y): 0.30 → 0.26 (ROI +9.6%, n=335, cov 88%).
  I2: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // Tuning 2026-07-09: DRAW validates at 0.32 (ROI +11.8%, n=92, cov 15%).
  IRL1: { enabled: true, threshold: 0.32, minSampleN: 10 },
  // Thin/noisy — 0.24 is the best-covered point (31.3% HR, n=64/497,
  // cov 13%). Monitor closely.
  ISL1: { enabled: true, threshold: 0.24, minSampleN: 15 },
  // KOR1 backtest 2026-05-24: DRAW ROI +23.2% on 140 preds at 0.26 — strong signal.
  KOR1: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // 0.26 gives 31.5% HR (n=321/845, cov 38%).
  KOR2: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // Tuning 2026-07-09: DRAW validates at 0.26 (ROI +12.0%, n=22/76,
  // cov 29%). Thin — minSampleN raised to 15.
  KSA1: { enabled: true, threshold: 0.26, minSampleN: 15 },
  // Tuning 2026-06-24 (1y): enable DRAW at 0.28 (ROI +12.9%, n=107, cov 36%).
  L1: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // 0.24 gives 31.0% HR (n=245/560, cov 44%) — best coverage available.
  LAT1: { enabled: true, threshold: 0.24, minSampleN: 10 },
  // MX1 backtest 2026-05-03: DRAW never exceeds 0.26 — Poisson limitation. Disable.
  MX1: { enabled: false, threshold: 0.36, minSampleN: 5 },
  // Weak signal across the board — 0.24 is the best-covered point
  // (21.8% HR, n=165/779, cov 21%). Monitor closely.
  NOR2: { enabled: true, threshold: 0.24, minSampleN: 15 },
  // PL backtest 2026-05-02: DRAW produced no qualified predictions and
  // should stay disabled until the selection pipeline improves.
  // Tuning 2026-06-24 (1y): enable at 0.30 (ROI +5.9%, n=52, cov 14%).
  PL: { enabled: true, threshold: 0.3, minSampleN: 10 },
  // Tuning 2026-06-24 (1y): enable DRAW at 0.30 (ROI +9.4%, n=61, cov 24%).
  POL1: { enabled: true, threshold: 0.3, minSampleN: 10 },
  // 0.24 gives 26.5% HR (n=536/897, cov 60%).
  POL2: { enabled: true, threshold: 0.24, minSampleN: 10 },
  // POR backtest 2026-05-05: 1/drawOdds signal validates where Poisson failed.
  // 2/3 seasons PASS: 2023-24 +37.0%, 2024-25 +0.9% (borderline), 2025-26 +8.9%.
  // Aggregate (257 picks, ~86/s): HR 35.8%, ROI +12.7%. threshold 0.30 = 1/3.33.
  // Tuning 2026-06-24 (1y): 0.30 → 0.26 (ROI +13.9%, n=179, cov 60%).
  POR: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // Tuning 2026-07-09: DRAW validates at 0.28 (ROI +13.6%, n=79, cov 39%).
  RUS1: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // SA analysis 2026-05-05: 1/drawOdds signal. Bracket [3.20–3.33) is the
  // sweet spot: [3.20–3.40) shows +13.6% ROI on 213 fixtures (SQL analysis).
  // threshold 0.30 = 1/3.33 → selects drawOdds < 3.33, centred on the best bracket.
  // Validation metric: ROI ≥ +5% + HR ≥ 32% (not hit rate 55% — see DRAW-SA-ANALYSIS.md).
  SA: { enabled: true, threshold: 0.3, minSampleN: 10 },
  // Tuning 2026-07-09: DRAW validates at 0.28 (ROI +1.7%, n=289, cov 43%).
  SCO1: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // SP2 backtest 2026-05-02: DRAW stays structurally weak even with a
  // dedicated low-threshold scan, so keep it disabled.
  SP2: { enabled: false, threshold: 0.35, minSampleN: 6 },
  // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): 0.26
  // gives 27.0% HR (n=278/863, cov 32%).
  SRB1: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): weak
  // signal, 0.26 gives the best available balance (26.7% HR, n=131/667,
  // cov 20%). Enabled to observe rather than left at the disabled default.
  SUI1: { enabled: true, threshold: 0.26, minSampleN: 15 },
  // 0.24 gives 29.1% HR (n=141/522, cov 27%) — best coverage available.
  SUI2: { enabled: true, threshold: 0.24, minSampleN: 10 },
  // 0.26 gives 32.6% HR (n=89/504, cov 18%).
  SVN1: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // SWE1 backtest 2026-05-24: DRAW ROI +10.9% on 43 preds at 0.30 (cote implicite < 3.33).
  SWE1: { enabled: true, threshold: 0.3, minSampleN: 10 },
  // Result-derived 2026-07-09 (no DRAW backtest run 2026-05-03): 0.24
  // gives 26.9% HR (n=372/751, cov 50%) — best coverage available.
  SWE2: { enabled: true, threshold: 0.24, minSampleN: 10 },
  // Tuning 2026-07-09 (post-rebuild, real priced odds): 0.28 validates
  // (ROI +8.6%, n=363, cov 45%) — supersedes the 2026-07-09 result-only
  // estimate (same threshold, now confirmed by real ROI with 6x the sample).
  TUR1: { enabled: true, threshold: 0.28, minSampleN: 10 },
  // Result-derived 2026-07-09 (no DRAW/BTTS backtest run 2026-05-03):
  // DRAW 0.26 gives 30.2% HR (n=424/1052, cov 40%) — good coverage+HR.
  TUR2: { enabled: true, threshold: 0.26, minSampleN: 10 },
  // UEL backtest 2026-05-03: DRAW was configured enabled but 14.3% hr at 0.34 — structural fail.
  UEL: { enabled: false, threshold: 0.34, minSampleN: 5 },
  // Weak signal across the board — 0.24 is the best-covered point
  // (25.5% HR, n=846/1338, cov 63%). Monitor closely.
  USA2: { enabled: true, threshold: 0.24, minSampleN: 15 },
  // DRAW (staked): observation-derived but profitable — 31 picks 38.7% HR at avg
  // odds 3.38, +8.45u (+27% ROI). The model rarely prices draws ≥0.28 (only 12
  // picks) and raising the gate collapses it; 0.25 = drawOdds < 4.00 captures the
  // signal. Kept unchanged (raised 0.20 → 0.25 on 2026-06-14).
  WC: { enabled: true, threshold: 0.25, minSampleN: 5 },
};
