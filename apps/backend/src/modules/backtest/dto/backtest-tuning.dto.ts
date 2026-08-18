import type {
  ChannelStrategyConfigChannel,
  GoalsLine,
  TeamTotalLine,
  TeamTotalTeam,
} from '@evcore/analysis-core';
import type {
  ThresholdPoint,
  ThresholdRecommendation,
} from '../tuning.metrics';
import type { GoalsTuningSide } from '../tuning.constants';

/** The threshold currently configured for a (channel × league) in code. */
export type CurrentChannelConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

/**
 * Offline threshold-tuning report for one (channel × competition): the full
 * sweep curve, the threshold configured today, and the recommended threshold.
 * Advisory only — a human edits `CHANNEL_STRATEGY_CONFIG`; nothing auto-applies.
 */
export type ChannelTuningReport = {
  channel: ChannelStrategyConfigChannel;
  competitionCode: string;
  competitionName: string;
  candidates: number;
  current: CurrentChannelConfig;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

/**
 * Offline tuning report for one GOALS (competition × line × side): the sweep
 * curve, the segment configured today, and the ROI-driven recommendation.
 * Advisory only — and must be confirmed per-season before flipping `enabled`.
 */
export type GoalsTuningReport = {
  competitionCode: string;
  competitionName: string;
  line: GoalsLine;
  side: GoalsTuningSide;
  candidates: number;
  current: CurrentChannelConfig | null;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

/**
 * Offline tuning report for one TEAM_TOTAL (competition × team × line ×
 * side) — same shape as `GoalsTuningReport` plus the team dimension.
 * Advisory only — a human edits `TEAM_TOTAL_CONFIG`.
 */
export type TeamTotalTuningReport = {
  competitionCode: string;
  competitionName: string;
  team: TeamTotalTeam;
  line: TeamTotalLine;
  side: GoalsTuningSide;
  candidates: number;
  current: CurrentChannelConfig | null;
  points: ThresholdPoint[];
  recommended: ThresholdRecommendation | null;
};

/** The BTTS NO threshold currently configured (global, single value). */
export type CurrentBttsNoConfig = {
  enabled: boolean;
  threshold: number;
};

/**
 * Offline tuning report for BTTS NO on one competition: the sweep curve, the
 * (currently global) threshold configured today, and the recommended per-league
 * threshold. Advisory — a human edits BTTS_NO_CONFIG. NO is calibrated
 * separately from the YES side (different probability scale).
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
  /** One row per (channel × competition) with at least one candidate. */
  reports: ChannelTuningReport[];
  /** One row per GOALS (competition × line × side) with at least one candidate. */
  goalsReports: GoalsTuningReport[];
  /** One row per competition with at least one BTTS NO candidate. */
  bttsNoReports: BttsNoTuningReport[];
  /** One row per TEAM_TOTAL (competition × team × line × side) with at least one candidate. */
  teamTotalReports: TeamTotalTuningReport[];
  generatedAt: string;
};
