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

export type ChannelTuningResponse = {
  from: string;
  to: string;
  reports: ChannelTuningReport[];
  generatedAt: string;
};
