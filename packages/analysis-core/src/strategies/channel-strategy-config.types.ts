export type ChannelStrategyLeagueConfig = {
  enabled: boolean;
  threshold: number;
  minSampleN: number;
};

export type ChannelStrategyConfigChannel =
  | "DOMINANT"
  | "DRAW"
  | "BTTS"
  | "CLEAN_SHEET"
  | "WIN_EITHER_HALF"
  | "WIN_TO_NIL"
  | "FIRST_HALF";
