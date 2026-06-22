import type { ChannelStrategyConfigChannel } from '@modules/betting-engine/strategies/channel-strategy.config';

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
};

export const TUNING_CHANNELS: ChannelStrategyConfigChannel[] = [
  'DOMINANT',
  'DRAW',
  'BTTS',
];
