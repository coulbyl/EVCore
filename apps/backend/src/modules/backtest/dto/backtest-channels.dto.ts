import type { StrategyChannel } from '@evcore/db';
import type { EvBin } from '../backtest.metrics';

export type BacktestVerdict = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';

/** Per-channel × competition backtest, localised — read from channel_selection. */
export type ChannelBacktestReport = {
  channel: StrategyChannel;
  competitionCode: string;
  competitionName: string;
  total: number;
  won: number;
  hitRate: number;
  /** Flat-stake ROI over settled selections. */
  roi: number;
  maxDrawdown: number;
  /** Expected Calibration Error of the channel's selection probability. */
  calibrationError: number;
  evBins: EvBin[];
  verdict: BacktestVerdict;
};

export type ChannelBacktestResponse = {
  from: string;
  to: string;
  minSample: number;
  roiFloor: number;
  /** One row per (channel × competition); sorted channel then competition. */
  reports: ChannelBacktestReport[];
};

/** Model-quality (Brier/ECE) backtest — channel-agnostic, per competition. */
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
