import { formatChannelForDisplayFr } from "@evcore/analysis-core";
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
  FIRST_HALF: "var(--canal-first-half)",
  DOUBLE_CHANCE: "var(--canal-double-chance)",
  UNDERDOG: "var(--canal-neutral)",
  FAVORITE: "var(--canal-neutral)",
  LIVE_VALUE: "var(--canal-neutral)",
  MARKET_MOVE: "var(--canal-neutral)",
  CONSENSUS: "var(--canal-consensus)",
  CONTRARIAN: "var(--canal-neutral)",
  AVOID: "var(--canal-avoid)",
  CORRECT_SCORE: "var(--canal-correct-score)",
  RESULT_TOTAL_GOALS: "var(--canal-result-total-goals)",
  OVER_UNDER_HT: "var(--canal-over-under-ht)",
  RESULT_BTTS: "var(--canal-result-btts)",
  DRAW_NO_BET: "var(--canal-draw-no-bet)",
  WIN_TO_NIL: "var(--canal-win-to-nil)",
  HALF_TIME_FULL_TIME: "var(--canal-half-time-full-time)",
  VANTAGE: "var(--canal-vantage)",
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
  FIRST_HALF: "var(--canal-first-half-soft)",
  DOUBLE_CHANCE: "var(--canal-double-chance-soft)",
  UNDERDOG: "var(--canal-neutral-soft)",
  FAVORITE: "var(--canal-neutral-soft)",
  LIVE_VALUE: "var(--canal-neutral-soft)",
  MARKET_MOVE: "var(--canal-neutral-soft)",
  CONSENSUS: "var(--canal-consensus-soft)",
  CONTRARIAN: "var(--canal-neutral-soft)",
  AVOID: "var(--canal-avoid-soft)",
  CORRECT_SCORE: "var(--canal-correct-score-soft)",
  RESULT_TOTAL_GOALS: "var(--canal-result-total-goals-soft)",
  OVER_UNDER_HT: "var(--canal-over-under-ht-soft)",
  RESULT_BTTS: "var(--canal-result-btts-soft)",
  DRAW_NO_BET: "var(--canal-draw-no-bet-soft)",
  WIN_TO_NIL: "var(--canal-win-to-nil-soft)",
  HALF_TIME_FULL_TIME: "var(--canal-half-time-full-time-soft)",
  VANTAGE: "var(--canal-vantage-soft)",
};

// English channel labels stay local to the frontend (no EN consumer exists
// outside apps/web) — same asymmetry as MARKET_LABELS_EN in
// apps/web/helpers/fixture.ts. French is the shared source of truth
// (@evcore/analysis-core's CHANNEL_LABELS_FR, mirrored by
// vantage-worker/backend if they ever need a canal name in prose) so it is
// never duplicated here.
const CHANNEL_LABEL_EN: Record<StrategyChannel, string> = {
  VALUE: "Value",
  SAFE: "Safety",
  DOMINANT: "Winner",
  BTTS: "BTTS",
  DRAW: "Draw",
  GOALS: "Goals",
  CLEAN_SHEET: "Clean sheet",
  TEAM_TOTAL: "Team goals",
  WIN_EITHER_HALF: "Wins a half",
  FIRST_HALF: "1st half",
  DOUBLE_CHANCE: "Double chance",
  UNDERDOG: "Underdog",
  FAVORITE: "Favorite",
  LIVE_VALUE: "Live value",
  MARKET_MOVE: "Line move",
  CONSENSUS: "Consensus",
  CONTRARIAN: "Contrarian",
  AVOID: "Caution",
  CORRECT_SCORE: "Exact score",
  RESULT_TOTAL_GOALS: "Result + Goals",
  OVER_UNDER_HT: "HT goals",
  RESULT_BTTS: "Result + BTTS",
  DRAW_NO_BET: "Draw no bet",
  WIN_TO_NIL: "Win to nil",
  HALF_TIME_FULL_TIME: "HT/FT",
  VANTAGE: "Arbitrage",
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
  FIRST_HALF: "channels.FIRST_HALF.description",
  DOUBLE_CHANCE: "channels.DOUBLE_CHANCE.description",
  UNDERDOG: "channels.UNDERDOG.description",
  FAVORITE: "channels.FAVORITE.description",
  LIVE_VALUE: "channels.LIVE_VALUE.description",
  MARKET_MOVE: "channels.MARKET_MOVE.description",
  CONSENSUS: "channels.CONSENSUS.description",
  CONTRARIAN: "channels.CONTRARIAN.description",
  AVOID: "channels.AVOID.description",
  CORRECT_SCORE: "channels.CORRECT_SCORE.description",
  RESULT_TOTAL_GOALS: "channels.RESULT_TOTAL_GOALS.description",
  OVER_UNDER_HT: "channels.OVER_UNDER_HT.description",
  RESULT_BTTS: "channels.RESULT_BTTS.description",
  DRAW_NO_BET: "channels.DRAW_NO_BET.description",
  WIN_TO_NIL: "channels.WIN_TO_NIL.description",
  HALF_TIME_FULL_TIME: "channels.HALF_TIME_FULL_TIME.description",
  VANTAGE: "channels.VANTAGE.description",
};

// Display order across both lenses (primaries, then AVOID gate, then the
// CONSENSUS aggregation as the final meta-channel). UNDERDOG/FAVORITE/
// LIVE_VALUE/MARKET_MOVE/CONTRARIAN are intentionally absent — never
// implemented as real strategies (see analysis-core's META_STRATEGY_
// CHANNELS/strategy registry), so nothing should ever list them, but they
// still need CHANNEL_COLOR/CHANNEL_LABEL_KEY entries above so a
// StrategyChannel value the frontend doesn't expect to render can't crash
// channelLabel/channelDescription if it ever appears (that's the bug this
// whole exhaustive-map pass fixes — DRAW_NO_BET hit it in production).
export const CHANNEL_ORDER: StrategyChannel[] = [
  "VALUE",
  "SAFE",
  "DOMINANT",
  "DRAW",
  "BTTS",
  "GOALS",
  "CLEAN_SHEET",
  "TEAM_TOTAL",
  "WIN_EITHER_HALF",
  "FIRST_HALF",
  "DOUBLE_CHANCE",
  "DRAW_NO_BET",
  "WIN_TO_NIL",
  "OVER_UNDER_HT",
  "HALF_TIME_FULL_TIME",
  "RESULT_TOTAL_GOALS",
  "RESULT_BTTS",
  "CORRECT_SCORE",
  "VANTAGE",
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

export function channelLabel(channel: StrategyChannel, locale: string): string {
  return locale === "en" ? CHANNEL_LABEL_EN[channel] : formatChannelForDisplayFr(channel);
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
