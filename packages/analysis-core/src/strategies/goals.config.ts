// ─────────────────────────────────────────────
// GOALS channel (Over/Under) — separate shape: the line dimension makes the
// calibration unit (league × line × side), not the league alone. Each
// (line, side) lives on its own probability scale (P(Over 1.5) ≈ 0.85 vs
// P(Over 4.5) ≈ 0.10), so a single per-league threshold is meaningless.
// Promotion is ROI-driven (see tuning.constants.ts), not hit-rate driven.
//
// Historical odds only cover the 2.5 line (the-odds-api backfill imports the
// main line only); the 1.5/3.5/4.5 lines exist solely from the API-Football
// PREMATCH sync, which accumulates forward. Decision 2026-06-24: stop waiting
// on a historical densify and instead OBSERVE forward on the lines we already
// price prematch — see the GOALS_CONFIG header below.
// ─────────────────────────────────────────────

export type GoalsLine = 1.5 | 2.5 | 3.5 | 4.5;
export type GoalsSide = "OVER" | "UNDER";

export type GoalsLineConfig = {
  line: GoalsLine;
  side: GoalsSide;
  enabled: boolean;
  // Minimum model probability for the side to qualify on this line.
  threshold: number;
  minSampleN: number;
};

export type GoalsLeagueConfig = {
  lines: readonly GoalsLineConfig[];
};

// GOALS — enabled in OBSERVATION (2026-06-24, contextual per-league broadening).
//
// IMPORTANT: this is NOT a validated staking edge. Multi-season validation on the
// 2.5 line was negative — per-season ROI positive only in the anomalous 2025-26
// season; goal rates and 1X2 calibration are flat across seasons (full analysis in
// git history). GOALS is never staked (only EV/SAFE/DRAW feed the coupon pool), so
// an enabled segment only emits a selection that is recorded + settled analytically
// — visible in the dashboard, accumulating forward data, with zero exposure.
//
// Curation method (per league, contextual): we cannot backtest 1.5/3.5/4.5 (no
// historical odds — they only exist forward via the PREMATCH sync), so segments are
// derived from each league's own goal profile rather than a sweep:
//   • side by profile: OVER when the line's empirical over-rate ≥ 0.55, UNDER when
//     ≤ 0.45, BOTH in the 0.45–0.55 band (the EV ranking then picks the best-priced).
//   • threshold = (empirical base rate of the chosen side) − 0.05 — a conviction
//     gate aligned to each league, loose enough to accumulate volume. The gate only
//     bounds the observed population; EV (prematch odds) does the actual selection.
//   • only lines with real prematch odds coverage (≥ 80 snapshots) are enabled.
// Per-entry comment shows the league's over-rate profile (o15/o25/o35/o45, n).
// Promote a segment to staking ONLY if forward ROI confirms a real edge (and add it
// to the coupon pool — signal-window.getTodayPool — which today excludes GOALS).
// Generated from DB goal-rate × prematch-coverage; re-derive if leagues change.
export const GOALS_CONFIG: Record<string, GoalsLeagueConfig> = {
  // o15 0.61 · o25 0.32 · o35 0.14 · o45 0.06 (n=1521) — low-scoring league.
  // 2.5 UNDER backtest 2026-07-09 (real priced odds): 0.45 validates
  // (ROI +15.3%, n=41, cov 95%) — kept over the profile estimate (0.63)
  // since it is real ROI evidence, not a formula.
  ARG1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.56,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.89,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.58 · o25 0.30 · o35 0.12 · o45 0.04 (n=2388) — very low-scoring
  // league. No 1X2/O-U odds coverage at all (no Odds API sport key) —
  // thresholds are profile estimates only (base − 0.05), observation only.
  ARG2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.53 -> 0.55 (ROI
        // +9.9%, n=28, hit 68%).
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.83,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.91,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.51 · o35 0.28 · o45 0.13 (n=585)
  // 2.5 UNDER backtest 2026-07-09: 0.65 validates (ROI +10.5%, n=26, cov 7%,
  // thin) — kept over the profile estimate (0.44) as real ROI evidence.
  AUT1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.52 · o35 0.30 · o45 0.15 (n=951)
  // 2.5 UNDER backtest 2026-07-09: 0.65 validates (ROI +15.3%, n=45, cov 8%)
  // — kept over the profile estimate (0.43) as real ROI evidence.
  BEL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.83 · o25 0.62 · o35 0.42 · o45 0.21 (n=924)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, real priced odds,
  // n=107 candidates): 0.57 -> 0.45 (ROI +15.6%, n=106, hit 70%) — the old
  // profile-estimate threshold left almost the whole sample unpriced.
  BL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.72 · o25 0.46 · o35 0.22 · o45 0.10 (n=1159)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=58 candidates):
  // 0.41 -> 0.45 (ROI +13.0%, n=44, hit 57%).
  BRA1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.85 -> 0.45 (ROI
        // +8.1%, n=30, hit 100%) — thin sample right at a very high-
        // probability line (see GOALS_PROMOTION_RULE comment: "clears any
        // hit-rate floor trivially"), revisit once volume grows.
        threshold: 0.45,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.64 · o25 0.38 · o35 0.17 · o45 0.06 (n=1300) — low-scoring league.
  // No 2.5-line backtest recommendation (554 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  BRA2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.59 -> 0.60 (ROI
        // +5.2%, n=27, hit 78%).
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.57,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.89,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.49 · o35 0.25 · o45 0.10 (n=1671)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=257 candidates):
  // 0.44 -> 0.5 (ROI +11.7%, n=69, hit 61%).
  CH: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.53 · o35 0.29 · o45 0.13 (n=840)
  // 2.5 OVER backtest 2026-07-09 (real priced odds): 0.55 validates
  // (ROI +5.6%, n=56, cov 20%) — kept over the profile estimate (0.48).
  CHI1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.70 · o25 0.47 · o35 0.26 · o45 0.15 (n=599)
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  CHI2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.72 · o25 0.44 · o35 0.23 · o45 0.11 (n=823) — low-scoring league.
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  CHN2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.79 · o25 0.57 · o35 0.38 · o45 0.20 (n=736)
  CSL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 15,
      },
      // New 2026-07-28 (backtest-tuning sweep): OVER 3.5 threshold 0.45
      // (ROI +10.2%, n=23, hit 48% — right at minSampleN, hit rate below
      // 50% but ROI-driven promotion; thin, revisit once volume grows).
      {
        line: 3.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Recalibrated 2026-07-03 on the recent blend (o35 0.45): base−0.05.
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.75 · o25 0.51 · o35 0.29 · o45 0.14 (n=819)
  CZE1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.81 · o25 0.59 · o35 0.35 · o45 0.18 (n=924)
  D2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.6 -> 0.65 (ROI
        // +8.9%, n=44, hit 70%).
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.82 · o25 0.59 · o35 0.36 · o45 0.20 (n=579)
  // No 2.5-line backtest recommendation (310 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  DEN1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.50 · o35 0.26 · o45 0.12 (n=1671)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=266 candidates):
  // 0.45 -> 0.6 (ROI +11.0%, n=51, hit 65%).
  EL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.50 · o35 0.28 · o45 0.13 (n=1671)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=295 candidates):
  // 0.45 -> 0.6 (ROI +27.4%, n=30, hit 67%).
  EL2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.84 · o25 0.60 · o35 0.39 · o45 0.20 (n=955)
  ERD: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.56 -> 0.55 (ROI
        // +10.8%, n=43, hit 65%).
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.57 · o35 0.32 · o45 0.15 (n=566)
  EST1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.52,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Recalibrated 2026-07-03 on the recent blend (o35 0.37): base−0.05.
        threshold: 0.58,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.69 · o25 0.47 · o35 0.26 · o45 0.12 (n=999)
  F2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.59 · o35 0.33 · o45 0.18 (n=547)
  // Recalibrated 2026-07-03: recent blend (2 last seasons, n=215) o15 0.83 ·
  // o25 0.66 · o35 0.44 · o45 0.26 — the league drifted offensive vs the
  // profile these thresholds were derived from (same failure mode as NOR2).
  // Probabilities are shrunk upstream (probability/ou-shrinkage.ts, factor
  // 0.28); thresholds follow base−0.05 on the recent blend.
  FIN1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.61,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.58 · o35 0.35 · o45 0.22 (n=338) — high-scoring league.
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  FIN2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.53,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.53 · o35 0.32 · o45 0.14 (n=343)
  FRI: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.52 · o35 0.27 · o45 0.13 (n=712)
  // 2.5 OVER backtest 2026-07-09 (real priced odds): 0.45 validates
  // (ROI +7.6%, n=287, cov 66%) — kept over the profile estimate (0.47).
  GRE1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.48 · o35 0.25 · o45 0.09 (n=1170)
  I2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.7 -> 0.45 (ROI
        // +6.0%, n=61, hit 80%).
        threshold: 0.45,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.71 · o25 0.47 · o35 0.25 · o45 0.11 (n=661)
  // No 2.5-line backtest recommendation (468 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  IRL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.86 · o25 0.64 · o35 0.47 · o45 0.29 (n=511)
  ISL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.71 · o25 0.47 · o35 0.24 · o45 0.12 (n=1266)
  J1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.71 · o25 0.49 · o35 0.28 · o45 0.13 (n=875)
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  KOR2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.44,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.46,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.67,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.79 · o25 0.56 · o35 0.36 · o45 0.19 (n=918)
  // No 2.5-line backtest recommendation (only 7 priced candidates — BTTS/O-U
  // odds coverage barely exists yet for this league) — thresholds below are
  // profile estimates only (base − 0.05), observation only.
  KSA1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.51,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.54 · o35 0.32 · o45 0.16 (n=925)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=136 candidates):
  // 0.49 -> 0.55 (ROI +18.3%, n=39, hit 69%).
  L1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.54 · o35 0.35 · o45 0.21 (n=570)
  LAT1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.48 · o35 0.26 · o45 0.14 (n=1140)
  LL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.47 -> 0.55 (ROI
        // +5.1%, n=28, hit 57%).
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.7 -> 0.60 (ROI
        // +6.3%, n=79, hit 77%).
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.81 · o25 0.60 · o35 0.37 · o45 0.21 (n=1132)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=80 candidates):
  // 0.55 -> 0.6 (ROI +18.2%, n=34, hit 76%).
  MLS: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.58,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.55 · o35 0.31 · o45 0.17 (n=1016)
  MX1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.4,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.79 · o25 0.59 · o35 0.38 · o45 0.19 (n=766)
  NOR1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.74,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.54 -> 0.60 (ROI
        // +6.0%, n=22, hit 68%).
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.57 -> 0.60 (ROI
        // +12.0%, n=49, hit 71%).
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
    ],
  },
  // Recalibrated 2026-07-03 on prod data (audit: 746 model runs, 4 seasons).
  // League drift: o35 0.31 → 0.39 → 0.39 → 0.58 (2026-27), avg goals 2.79 →
  // 3.98. Blended recent base (2025-26 + 2026-27, n=304): o15 0.87 · o25 0.66
  // · o35 0.43 · o45 0.24. corr(λ_total, goals) ≈ 0 every season and the
  // predicted→realized slope is ~0.25 → the model has league-LEVEL signal
  // only. The calibration itself is handled upstream by the O/U probability
  // shrinkage (probability/ou-shrinkage.ts, factor 0.25 toward the recent
  // base rates), so thresholds follow the standard base−0.05 rule on the
  // RECENT blend. Root cause (no xG in data-poor leagues) tracked in
  // docs/data-poor-leagues-calibration.md.
  NOR2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        // Tuning 2026-07-09 (post-rebuild, real priced odds) set 0.65 (ROI
        // +15.5%, n=38, cov 70%). Retuned 2026-07-24 (larger n=43 sweep):
        // 0.65 -> 0.45 (ROI +10.4%, n=43, hit 77%) — the higher threshold was
        // overfit to the smaller earlier sample, missing most real value.
        threshold: 0.45,
        minSampleN: 15,
      },
      // New 2026-07-28 (backtest-tuning sweep): OVER 3.5 threshold 0.50
      // (ROI +31.6%, n=20, hit 65% — right at minSampleN, thin, revisit
      // once volume grows).
      {
        line: 3.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Recent under-rate 0.57 − 0.05. Shrunk probabilities cap under35 at
        // ~0.68 for this league, so the old 0.58 gate on raw (noise) probas —
        // which realized 37.5% live — cannot recur.
        threshold: 0.52,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.82 · o25 0.59 · o35 0.35 · o45 0.17 (n=1140)
  PL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.77,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.6 -> 0.45 (ROI
        // +12.6%, n=69, hit 74%).
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.78,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.50 · o35 0.30 · o45 0.14 (n=918)
  // 2.5 retuned 2026-07-24 (backtest-tuning sweep, n=122 candidates):
  // OVER 0.45 -> 0.55 (ROI +20.6%, n=35, hit 66%),
  // UNDER 0.45 -> 0.5 (ROI +11.1%, n=53, hit 58%).
  POL1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.55 · o35 0.31 · o45 0.15 (n=925)
  POL2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.75 · o25 0.53 · o35 0.30 · o45 0.13 (n=924)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=117 candidates):
  // 0.48 -> 0.5 (ROI +21.3%, n=43, hit 67%).
  POR: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.75 · o25 0.48 · o35 0.27 · o45 0.13 (n=732)
  // No 2.5-line backtest recommendation (only 25 priced candidates) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  RUS1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.43,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.47,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.82,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.48 · o35 0.25 · o45 0.11 (n=1139)
  // 2.5 retuned 2026-07-24 (backtest-tuning sweep, n=151 candidates):
  // OVER 0.43 -> 0.5 (ROI +11.3%, n=26, hit 58%),
  // UNDER 0.47 -> 0.55 (ROI +27.9%, n=73, hit 68%).
  SA: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.7 -> 0.45 (ROI
        // +10.0%, n=69, hit 83%).
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.55 · o35 0.32 · o45 0.14 (n=702)
  // No 2.5-line backtest recommendation (421 candidates swept, no PASS) —
  // thresholds below are profile estimates only (base − 0.05), observation only.
  SCO1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.69 · o25 0.45 · o35 0.25 · o45 0.11 (n=1403)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=213 candidates):
  // 0.4 -> 0.55 (ROI +9.7%, n=106, hit 60%) — the old threshold let too many
  // low-edge picks through.
  SP2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.7,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.84,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.74 · o25 0.53 · o35 0.32 · o45 0.16 (n=892)
  SRB1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.69,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.48,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.42,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.81 · o25 0.59 · o35 0.36 · o45 0.19 (n=690)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=36 candidates):
  // 0.54 -> 0.5 (ROI +7.4%, n=34, hit 68%).
  SUI1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.76,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.59,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.59 · o35 0.35 · o45 0.16 (n=538) — high-scoring league.
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  SUI2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.6,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.80 · o25 0.55 · o35 0.32 · o45 0.16 (n=522)
  SVN1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.75,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.54 · o35 0.30 · o45 0.15 (n=767)
  SWE1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.49,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.65,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.8,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.76 · o25 0.55 · o35 0.32 · o45 0.14 (n=780)
  SWE2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.71,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.81,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.53 · o35 0.31 · o45 0.16 (n=1028)
  // 2.5 OVER retuned 2026-07-24 (backtest-tuning sweep, n=98 candidates):
  // 0.48 -> 0.55 (ROI +10.9%, n=25, hit 64%).
  TUR1: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-09 (post-rebuild, real priced odds) set 0.6 (ROI
        // +32.9%, n=36, cov 7%), replacing a flat-negative 0.42 profile
        // estimate. Retuned 2026-07-24 (n=98 candidates): 0.6 -> 0.55
        // (ROI +26.7%, n=29, hit 66%) — comparable ROI, wider coverage.
        threshold: 0.55,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.78 · o25 0.59 · o35 0.38 · o45 0.23 (n=774)
  UCL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.73,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.54,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.57 -> 0.55 (ROI
        // +7.0%, n=47, hit 72%).
        threshold: 0.55,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.55 · o35 0.31 · o45 0.17 (n=1235)
  UECL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.41,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.64,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.77 · o25 0.56 · o35 0.32 · o45 0.16 (n=715)
  UEL: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.72,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        // Tuning 2026-07-28 (backtest-tuning sweep): 0.51 -> 0.50 (ROI
        // +8.0%, n=48, hit 58%).
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.63,
        minSampleN: 15,
      },
    ],
  },
  // o15 0.73 · o25 0.50 · o35 0.29 · o45 0.16 (n=1394)
  // No 1X2/O-U odds coverage at all (no Odds API sport key) — thresholds are
  // profile estimates only (base − 0.05), observation only.
  USA2: {
    lines: [
      {
        line: 1.5,
        side: "OVER",
        enabled: true,
        threshold: 0.68,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
      {
        line: 3.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.66,
        minSampleN: 15,
      },
      {
        line: 4.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.79,
        minSampleN: 15,
      },
    ],
  },
  // No prior config — added 2026-07-24 (backtest-tuning sweep, n=104
  // candidates, World Cup 2026 fixtures).
  WC: {
    lines: [
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.5,
        minSampleN: 15,
      },
      {
        line: 2.5,
        side: "UNDER",
        enabled: true,
        threshold: 0.55,
        minSampleN: 15,
      },
    ],
  },
  // No prior config — added 2026-07-24 (backtest-tuning sweep, n=43
  // candidates, World Cup Qualification - Europe).
  WCQE: {
    lines: [
      {
        line: 2.5,
        side: "OVER",
        enabled: true,
        threshold: 0.45,
        minSampleN: 15,
      },
    ],
  },
};

// Resolve the enabled GOALS line configs for a league (empty when none).
export function getGoalsLineConfigs(
  competitionCode: string | null | undefined,
): readonly GoalsLineConfig[] {
  if (competitionCode == null) return [];
  const leagueConfig = GOALS_CONFIG[competitionCode];
  if (!leagueConfig) return [];
  return leagueConfig.lines.filter((l) => l.enabled);
}
