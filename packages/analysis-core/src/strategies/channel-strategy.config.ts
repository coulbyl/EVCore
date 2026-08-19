import type {
  ChannelStrategyConfigChannel,
  ChannelStrategyLeagueConfig,
} from "./channel-strategy-config.types";
import { DOMINANT_CONFIG, DOMINANT_DEFAULT } from "./dominant.config";
import { DRAW_CONFIG, DRAW_DEFAULT } from "./draw.config";
import { BTTS_CONFIG, BTTS_DEFAULT } from "./btts.config";
import { CLEAN_SHEET_CONFIG, CLEAN_SHEET_DEFAULT } from "./clean-sheet.config";
import {
  WIN_EITHER_HALF_CONFIG,
  WIN_EITHER_HALF_DEFAULT,
} from "./win-either-half.config";
import { WIN_TO_NIL_CONFIG, WIN_TO_NIL_DEFAULT } from "./win-to-nil.config";
import {
  FIRST_HALF_CONFIG,
  FIRST_HALF_DEFAULT,
} from "./first-half-winner.config";

export const CHANNEL_STRATEGY_CONFIG_CHANNELS: ChannelStrategyConfigChannel[] =
  ["DOMINANT", "DRAW", "BTTS", "CLEAN_SHEET", "WIN_EITHER_HALF"];

export function getChannelStrategyConfig(
  channel: ChannelStrategyConfigChannel,
  competitionCode: string | null | undefined,
): ChannelStrategyLeagueConfig {
  switch (channel) {
    case "DOMINANT":
      return (
        (competitionCode != null
          ? DOMINANT_CONFIG[competitionCode]
          : undefined) ?? DOMINANT_DEFAULT
      );
    case "DRAW":
      return (
        (competitionCode != null ? DRAW_CONFIG[competitionCode] : undefined) ??
        DRAW_DEFAULT
      );
    case "BTTS":
      return (
        (competitionCode != null ? BTTS_CONFIG[competitionCode] : undefined) ??
        BTTS_DEFAULT
      );
    case "CLEAN_SHEET":
      return (
        (competitionCode != null
          ? CLEAN_SHEET_CONFIG[competitionCode]
          : undefined) ?? CLEAN_SHEET_DEFAULT
      );
    case "WIN_EITHER_HALF":
      return (
        (competitionCode != null
          ? WIN_EITHER_HALF_CONFIG[competitionCode]
          : undefined) ?? WIN_EITHER_HALF_DEFAULT
      );
    case "WIN_TO_NIL":
      return (
        (competitionCode != null
          ? WIN_TO_NIL_CONFIG[competitionCode]
          : undefined) ?? WIN_TO_NIL_DEFAULT
      );
    case "FIRST_HALF":
      return (
        (competitionCode != null
          ? FIRST_HALF_CONFIG[competitionCode]
          : undefined) ?? FIRST_HALF_DEFAULT
      );
  }
}
