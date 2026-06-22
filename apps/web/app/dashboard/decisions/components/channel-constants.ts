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
};

export const CHANNEL_COLOR_SOFT: Record<StrategyChannel, string> = {
  VALUE: "var(--canal-value-soft)",
  SAFE: "var(--canal-safe-soft)",
  DOMINANT: "var(--canal-dominant-soft)",
  BTTS: "var(--canal-btts-soft)",
  DRAW: "var(--canal-draw-soft)",
};

const CHANNEL_LABEL_KEY: Record<StrategyChannel, string> = {
  VALUE: "channels.VALUE.label",
  SAFE: "channels.SAFE.label",
  DOMINANT: "channels.DOMINANT.label",
  BTTS: "channels.BTTS.label",
  DRAW: "channels.DRAW.label",
};

const CHANNEL_DESCRIPTION_KEY: Record<StrategyChannel, string> = {
  VALUE: "channels.VALUE.description",
  SAFE: "channels.SAFE.description",
  DOMINANT: "channels.DOMINANT.description",
  BTTS: "channels.BTTS.description",
  DRAW: "channels.DRAW.description",
};

// Display order across both lenses.
export const CHANNEL_ORDER: StrategyChannel[] = [
  "VALUE",
  "SAFE",
  "DOMINANT",
  "BTTS",
  "DRAW",
];

const REASON_LABEL_KEY: Record<string, string> = {
  score_below_threshold: "reasons.score_below_threshold",
  no_viable_pick: "reasons.no_viable_pick",
  line_movement: "reasons.line_movement",
  no_safe_candidate: "reasons.no_safe_candidate",
  below_threshold: "reasons.below_threshold",
  insufficient_margin: "reasons.insufficient_margin",
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
