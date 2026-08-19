import type {
  ChannelStrategyConfigChannel,
  GoalsLine,
  TeamTotalLine,
  TeamTotalTeam,
} from '@evcore/analysis-core';

/**
 * Offline threshold-tuning grids and promotion floors for the three
 * config-driven channels (`CHANNEL_STRATEGY_CONFIG`). The tuning brick sweeps
 * these candidate thresholds against settled history (read from
 * `model_run.features` + odds) and recommends a per-league threshold. It never
 * auto-applies — a human reads the recommendation and edits the config.
 */

/** Candidate thresholds swept per channel (ascending). */
export const TUNING_THRESHOLD_GRID: Record<
  ChannelStrategyConfigChannel,
  number[]
> = {
  // DOMINANT signal = argmax(1X2) probability.
  DOMINANT: [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
  // DRAW signal = bookmaker implied probability (1/drawOdds).
  DRAW: [0.24, 0.26, 0.28, 0.3, 0.32, 0.34, 0.36],
  // BTTS signal = model P(both teams score).
  BTTS: [0.5, 0.52, 0.55, 0.58, 0.6, 0.62, 0.65],
  // CLEAN_SHEET signal = model P(team keeps a clean sheet). Placeholder grid
  // (2026-07-18, no backtest yet) — same scale as BTTS since both are
  // binary defensive/offensive signals in a comparable probability range.
  CLEAN_SHEET: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65],
  // WIN_EITHER_HALF signal = model P(team wins at least one half) — not
  // bounded like a two-way split (see analysis-core probability/markets.ts
  // comment), so the grid reaches higher than BTTS/CLEAN_SHEET. Placeholder
  // grid (2026-07-18, no backtest yet).
  WIN_EITHER_HALF: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
  // WIN_TO_NIL signal = model P(side wins AND opponent scores 0). Placeholder
  // grid (2026-08-16, no backtest yet) — same scale as CLEAN_SHEET (both are
  // defensive+result combo signals derived from settled base rates ~0.15-0.4).
  WIN_TO_NIL: [0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
  // FIRST_HALF signal = argmax(HOME/DRAW/AWAY) probability at half-time.
  // Placeholder grid (2026-08-16, no backtest yet) — shifted well below
  // DOMINANT's full-time range: DRAW is the modal HT outcome in most
  // htft-calibrated leagues (~0.30-0.43), a 3-way split with much less
  // separation than full-time favorites.
  FIRST_HALF: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
};

/**
 * Per-channel promotion rule used to flag a threshold as PASS. Mirrors the
 * methodology recorded in the `CHANNEL_STRATEGY_CONFIG` comments:
 * - prediction channels (DOMINANT/BTTS) promote on hit rate + non-negative ROI,
 * - DRAW promotes on ROI (the draw is priced as a value signal, not a favourite).
 */
export type ChannelPromotionRule = {
  minSample: number;
  /** Minimum hit rate; `null` when the channel is judged on ROI alone. */
  hitRateFloor: number | null;
  roiFloor: number;
};

export const CHANNEL_PROMOTION_RULE: Record<
  ChannelStrategyConfigChannel,
  ChannelPromotionRule
> = {
  DOMINANT: { minSample: 20, hitRateFloor: 0.55, roiFloor: 0 },
  BTTS: { minSample: 20, hitRateFloor: 0.55, roiFloor: 0 },
  DRAW: { minSample: 20, hitRateFloor: 0.32, roiFloor: 0.05 },
  // Placeholder rules (2026-07-18, no backtest yet) — same hit-rate/ROI
  // methodology as BTTS (both are prediction channels, argmax between two
  // candidates), to be confirmed once real settled data accumulates.
  CLEAN_SHEET: { minSample: 20, hitRateFloor: 0.55, roiFloor: 0 },
  WIN_EITHER_HALF: { minSample: 20, hitRateFloor: 0.55, roiFloor: 0 },
  WIN_TO_NIL: { minSample: 20, hitRateFloor: 0.55, roiFloor: 0 },
  // Lower floor than DOMINANT/BTTS (0.55): DRAW is the modal HT outcome at
  // only ~30-43% base rate in htft-calibrated leagues, so a 0.55 floor would
  // be unreachable by construction, not a real quality bar.
  FIRST_HALF: { minSample: 20, hitRateFloor: 0.4, roiFloor: 0 },
};

export const TUNING_CHANNELS: ChannelStrategyConfigChannel[] = [
  'DOMINANT',
  'DRAW',
  'BTTS',
  'CLEAN_SHEET',
  'WIN_EITHER_HALF',
  'WIN_TO_NIL',
  'FIRST_HALF',
];

/**
 * GOALS (Over/Under) tuning. The calibration unit is (line × side), not the
 * league alone — each lives on its own probability scale — so the sweep runs
 * per (line × side). Odds coverage for 1.5/3.5/4.5 confirmed 2026-07-28
 * (2600/2603/1611 fixtures, PREMATCH sync) — swept alongside 2.5 (the-odds-api
 * backfill, deepest history) since GOALS_CONFIG's "cannot backtest 1.5/3.5/4.5"
 * limitation no longer holds. Promotion is ROI-driven (like DRAW):
 * high-probability low lines clear any hit-rate floor trivially but bleed ROI
 * after the vig, so hit rate is not a meaningful gate here. The recommendation
 * must still be confirmed per-season before flipping a segment to enabled in
 * `GOALS_CONFIG`.
 */
export const GOALS_TUNING_SIDES = ['OVER', 'UNDER'] as const;
export type GoalsTuningSide = (typeof GOALS_TUNING_SIDES)[number];

export const GOALS_TUNING_LINES: GoalsLine[] = [1.5, 2.5, 3.5, 4.5];

export const GOALS_TUNING_THRESHOLD_GRID: number[] = [
  0.45, 0.5, 0.55, 0.6, 0.65,
];

export const GOALS_PROMOTION_RULE: ChannelPromotionRule = {
  minSample: 20,
  hitRateFloor: null,
  roiFloor: 0.05,
};

/**
 * TEAM_TOTAL (per-team Over/Under) tuning — same shape as GOALS, doubled on
 * the team dimension (HOME/AWAY have independent lines/sides). No historical
 * ROI backtest exists yet (TEAM_TOTAL_CONFIG's thresholds are structural,
 * derived from raw score base rates — see its header comment); odds coverage
 * confirmed 2026-07-28 (417 fixtures per team, PREMATCH sync only, smaller
 * than GOALS — most (league × line × side × team) combinations will land
 * below minSample, which is expected, not a bug). Grid/rule start as a copy
 * of GOALS' (identical structure, ROI-driven) — revisit once real volume
 * accumulates.
 */
export const TEAM_TOTAL_TEAMS: TeamTotalTeam[] = ['HOME', 'AWAY'];
export const TEAM_TOTAL_TUNING_LINES: TeamTotalLine[] = [
  0.5, 1.5, 2.5, 3.5, 4.5,
];

export const TEAM_TOTAL_TUNING_THRESHOLD_GRID: number[] = [
  0.45, 0.5, 0.55, 0.6, 0.65,
];

export const TEAM_TOTAL_PROMOTION_RULE: ChannelPromotionRule = {
  minSample: 20,
  hitRateFloor: null,
  roiFloor: 0.05,
};
