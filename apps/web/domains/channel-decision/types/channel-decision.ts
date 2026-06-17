// Mirror of the backend ChannelDecisionItem DTO (GET /channel-decisions).
// v1 strategy channels — kept in sync with the backend StrategyChannel enum.
export type StrategyChannel = "EV" | "SAFE" | "DOMINANT" | "BTTS" | "DRAW";

export type ChannelDecisionStatus =
  | "SELECTED"
  | "REJECTED"
  | "DISABLED"
  | "INSUFFICIENT_DATA"
  | "MISSING_ODDS"
  | "NOT_APPLICABLE";

export type SelectionResult = "PENDING" | "WON" | "LOST" | "VOID";

export type ChannelSelectionDto = {
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  probability: number;
  odds: number | null;
  impliedProbability: number | null;
  ev: number | null;
  qualityScore: number | null;
  rank: number;
  result: SelectionResult | null;
};

export type ChannelDecisionDto = {
  id: string;
  fixtureId: string;
  modelRunId: string;
  competition: string | null;
  country: string | null;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  kickoff: string;
  score: string | null;
  htScore: string | null;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  selections: ChannelSelectionDto[];
};

export type ChannelDecisionFilters = {
  competition?: string;
  channel?: StrategyChannel;
  market?: string;
  status?: ChannelDecisionStatus;
};
