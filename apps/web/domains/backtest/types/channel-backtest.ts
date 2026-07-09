import type { StrategyChannel } from "@/domains/channel-decision/types/channel-decision";

export type BacktestVerdict = "PASS" | "FAIL" | "INSUFFICIENT_DATA";

export type EvBin = {
  label: string;
  from: number | null;
  to: number | null;
  total: number;
  won: number;
  hitRate: number;
  roi: number;
};

/** Per-channel × competition backtest (POST /backtest/channels). */
export type ChannelBacktestReport = {
  channel: StrategyChannel;
  competitionCode: string;
  competitionName: string;
  total: number;
  won: number;
  hitRate: number;
  /** Settled selections with a priced odds snapshot — the real ROI/verdict sample size. */
  pricedCount: number;
  roi: number;
  maxDrawdown: number;
  calibrationError: number;
  evBins: EvBin[];
  verdict: BacktestVerdict;
};

export type ChannelBacktestResponse = {
  from: string;
  to: string;
  minSample: number;
  roiFloor: number;
  reports: ChannelBacktestReport[];
};

/** Model-quality (Brier/ECE) backtest (POST /backtest/calibration). */
export type ModelCalibrationReport = {
  competitionCode: string;
  competitionName: string;
  analyzedCount: number;
  brierScore: number;
  calibrationError: number;
  verdict: BacktestVerdict;
};

export type ModelCalibrationResponse = {
  from: string;
  to: string;
  minSample: number;
  brierPassThreshold: number;
  calibrationPassThreshold: number;
  reports: ModelCalibrationReport[];
};

/** Config channel subset that the tuning brick sweeps. */
export type TuningChannel = "DOMINANT" | "DRAW" | "BTTS";

export type ThresholdPoint = {
  threshold: number;
  total: number;
  won: number;
  hitRate: number;
  coverage: number;
  roi: number;
};

export type ThresholdRecommendation = ThresholdPoint & { verdict: "PASS" };

export type CurrentChannelConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

/** Offline threshold tuning (POST /backtest/tuning) — advisory only. */
export type ChannelTuningReport = {
  channel: TuningChannel;
  competitionCode: string;
  competitionName: string;
  candidates: number;
  current: CurrentChannelConfig;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

/** Over/Under side that the GOALS tuning sweep evaluates. */
export type GoalsTuningSide = "OVER" | "UNDER";

/**
 * Offline tuning report for one GOALS (competition × line × side). `current` is
 * null when the league has no config entry for that line/side. Advisory only —
 * a segment must be confirmed per-season before flipping `enabled`.
 */
export type GoalsTuningReport = {
  competitionCode: string;
  competitionName: string;
  line: number;
  side: GoalsTuningSide;
  candidates: number;
  current: CurrentChannelConfig | null;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

/** The BTTS NO threshold currently configured for a competition (per-league). */
export type CurrentBttsNoConfig = {
  enabled: boolean;
  threshold: number;
};

/**
 * Offline tuning report for BTTS NO on one competition. NO is calibrated
 * separately from the YES side (different probability scale) and per-league.
 * Advisory only — observation channel, never staked.
 */
export type BttsNoTuningReport = {
  competitionCode: string;
  competitionName: string;
  candidates: number;
  current: CurrentBttsNoConfig;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

export type ChannelTuningResponse = {
  from: string;
  to: string;
  reports: ChannelTuningReport[];
  goalsReports: GoalsTuningReport[];
  bttsNoReports: BttsNoTuningReport[];
  generatedAt: string;
};
