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
 * ratio réel/annoncé, never the channel's own claimed edge (see
 * feedback_admission_par_calibration in project memory: admission is judged
 * on calibration, never on ROI or self-reported confidence). */
export type ChannelCalibration = {
  channel: StrategyChannel;
  sampleSize: number;
  hitRate: number | null;
  roi: number | null;
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
