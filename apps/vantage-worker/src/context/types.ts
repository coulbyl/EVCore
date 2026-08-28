import type { StrategyChannel, Market } from "@evcore/analysis-core";

/** One other channel's read on this match — VANTAGE's own decision is never
 * included here (see build-match-context.ts). */
export type ChannelReading = {
  channel: StrategyChannel;
  status: "SELECTED" | "REJECTED" | "OTHER";
  reasonCode: string | null;
  market: Market | null;
  pick: string | null;
  probability: number | null;
  odds: number | null;
  ev: number | null;
};

/** How reliable a channel has actually been on this exact competition —
 * ratio réel/annoncé, never ROI or the channel's own claimed edge (see
 * feedback_admission_par_calibration in project memory: admission is judged
 * on calibration, never on ROI or self-reported confidence — ROI's variance
 * is dominated by the odds of the few winning bets, so it stays noisy well
 * past n=200 for a channel playing heterogeneous odds; see incident
 * 2026-08-28, where VANTAGE built its "tension" reasoning on exactly that
 * noise). */
export type ChannelCalibration = {
  channel: StrategyChannel;
  sampleSize: number;
  hitRate: number | null;
  /** hitRate ÷ average announced probability. 1.0 = perfectly calibrated,
   * <1 = overconfident (wins less often than it claimed), >1 =
   * underconfident. Self-interpreting regardless of the market's baseline
   * win rate — unlike a bare hit rate, which reads very differently for
   * DOUBLE_CHANCE (high baseline) than for CORRECT_SCORE (low baseline). */
  calibrationRatio: number | null;
};

export type MatchContext = {
  fixtureId: string;
  modelRunId: string;
  homeTeam: string;
  awayTeam: string;
  competitionCode: string | null;
  competitionName: string | null;
  kickoff: string;
  readings: ChannelReading[];
  calibration: ChannelCalibration[];
};
