import type {
  ChannelDecisionStatus,
  StrategyChannel,
} from "@/domains/channel-decision/types/channel-decision";

// StrategyChannel → design tokens (1:1 with the legacy --canal-* palette).
export const CHANNEL_COLOR: Record<StrategyChannel, string> = {
  VALUE: "var(--canal-value)",
  SAFE: "var(--canal-safe)",
  DOMINANT: "var(--canal-dominant)",
  BTTS: "var(--canal-btts)",
  DRAW: "var(--canal-draw)",
  GOALS: "var(--canal-goals)",
  CLEAN_SHEET: "var(--canal-clean-sheet)",
  TEAM_TOTAL: "var(--canal-team-total)",
  WIN_EITHER_HALF: "var(--canal-win-either-half)",
  CONSENSUS: "var(--canal-consensus)",
  AVOID: "var(--canal-avoid)",
  CORRECT_SCORE: "var(--canal-correct-score)",
};

export const CHANNEL_COLOR_SOFT: Record<StrategyChannel, string> = {
  VALUE: "var(--canal-value-soft)",
  SAFE: "var(--canal-safe-soft)",
  DOMINANT: "var(--canal-dominant-soft)",
  BTTS: "var(--canal-btts-soft)",
  DRAW: "var(--canal-draw-soft)",
  GOALS: "var(--canal-goals-soft)",
  CLEAN_SHEET: "var(--canal-clean-sheet-soft)",
  TEAM_TOTAL: "var(--canal-team-total-soft)",
  WIN_EITHER_HALF: "var(--canal-win-either-half-soft)",
  CONSENSUS: "var(--canal-consensus-soft)",
  AVOID: "var(--canal-avoid-soft)",
  CORRECT_SCORE: "var(--canal-correct-score-soft)",
};

const CHANNEL_LABEL_KEY: Record<StrategyChannel, string> = {
  VALUE: "channels.VALUE.label",
  SAFE: "channels.SAFE.label",
  DOMINANT: "channels.DOMINANT.label",
  BTTS: "channels.BTTS.label",
  DRAW: "channels.DRAW.label",
  GOALS: "channels.GOALS.label",
  CLEAN_SHEET: "channels.CLEAN_SHEET.label",
  TEAM_TOTAL: "channels.TEAM_TOTAL.label",
  WIN_EITHER_HALF: "channels.WIN_EITHER_HALF.label",
  CONSENSUS: "channels.CONSENSUS.label",
  AVOID: "channels.AVOID.label",
  CORRECT_SCORE: "channels.CORRECT_SCORE.label",
};

const CHANNEL_DESCRIPTION_KEY: Record<StrategyChannel, string> = {
  VALUE: "channels.VALUE.description",
  SAFE: "channels.SAFE.description",
  DOMINANT: "channels.DOMINANT.description",
  BTTS: "channels.BTTS.description",
  DRAW: "channels.DRAW.description",
  GOALS: "channels.GOALS.description",
  CLEAN_SHEET: "channels.CLEAN_SHEET.description",
  TEAM_TOTAL: "channels.TEAM_TOTAL.description",
  WIN_EITHER_HALF: "channels.WIN_EITHER_HALF.description",
  CONSENSUS: "channels.CONSENSUS.description",
  AVOID: "channels.AVOID.description",
  CORRECT_SCORE: "channels.CORRECT_SCORE.description",
};

// Display order across both lenses (primaries, then AVOID gate, then the
// CONSENSUS aggregation as the final meta-channel).
export const CHANNEL_ORDER: StrategyChannel[] = [
  "VALUE",
  "SAFE",
  "DOMINANT",
  "BTTS",
  "DRAW",
  "GOALS",
  "CLEAN_SHEET",
  "TEAM_TOTAL",
  "WIN_EITHER_HALF",
  "CORRECT_SCORE",
  "AVOID",
  "CONSENSUS",
];

const REASON_LABEL_KEY: Record<string, string> = {
  score_below_threshold: "reasons.score_below_threshold",
  no_viable_pick: "reasons.no_viable_pick",
  line_movement: "reasons.line_movement",
  no_safe_candidate: "reasons.no_safe_candidate",
  below_threshold: "reasons.below_threshold",
  insufficient_margin: "reasons.insufficient_margin",
  no_consensus: "reasons.no_consensus",
  consensus: "reasons.consensus",
  no_avoid_signal: "reasons.no_avoid_signal",
  extreme_divergence: "reasons.extreme_divergence",
  no_model: "reasons.no_model",
  no_odds: "reasons.no_odds",
  no_modelable_scoreline: "reasons.no_modelable_scoreline",
  below_conviction: "reasons.below_conviction",
  BACKFILL: "reasons.BACKFILL",
};

type Translator = (key: string) => string;

export function channelLabel(channel: StrategyChannel, t: Translator): string {
  return t(CHANNEL_LABEL_KEY[channel]);
}

export function channelDescription(
  channel: StrategyChannel,
  t: Translator,
): string {
  return t(CHANNEL_DESCRIPTION_KEY[channel]);
}

export function reasonLabel(
  reasonCode: string | null,
  t: Translator,
): string | null {
  if (reasonCode === null) return null;
  const key = REASON_LABEL_KEY[reasonCode];
  return key ? t(key) : reasonCode;
}

const STATUS_LABEL_KEY: Record<ChannelDecisionStatus, string> = {
  SELECTED: "statuses.SELECTED",
  REJECTED: "statuses.REJECTED",
  DISABLED: "statuses.DISABLED",
  INSUFFICIENT_DATA: "statuses.INSUFFICIENT_DATA",
  MISSING_ODDS: "statuses.MISSING_ODDS",
  NOT_APPLICABLE: "statuses.NOT_APPLICABLE",
};

export function statusLabel(
  status: ChannelDecisionStatus,
  t: Translator,
): string {
  return t(STATUS_LABEL_KEY[status]);
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function formatOdds(odds: number | null): string | null {
  return odds === null ? null : odds.toFixed(2);
}

export function formatEv(ev: number | null): string | null {
  return ev === null ? null : `${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(0)}%`;
}
