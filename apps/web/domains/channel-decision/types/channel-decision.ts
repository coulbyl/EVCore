// Mirror of the backend ChannelDecisionItem DTO (GET /channel-decisions).
// Kept in sync with the backend StrategyChannel enum. GOALS and CORRECT_SCORE
// are primary channels; CONSENSUS and AVOID are phase-2 meta-channels.

export type StrategyChannel =
  | "VALUE"
  | "SAFE"
  | "DOMINANT"
  | "BTTS"
  | "DRAW"
  | "GOALS"
  | "CONSENSUS"
  | "AVOID"
  | "CORRECT_SCORE";

export type ChannelDecisionStatus =
  | "SELECTED"
  | "REJECTED"
  | "DISABLED"
  | "INSUFFICIENT_DATA"
  | "MISSING_ODDS"
  | "NOT_APPLICABLE";

export type ModelRunPhase = "ADVANCE" | "PRE_KICKOFF" | "LIVE";

export type SelectionResult = "PENDING" | "WON" | "LOST" | "VOID";

export type AvoidOffender = {
  channel: StrategyChannel;
  market: string;
  pick: string;
  edge: number;
  result?: SelectionResult | null;
};

export type AvoidReasonDetails = {
  maxEdge: number;
  offenders: AvoidOffender[];
};

export type ConsensusReasonDetails = {
  level: number;
  classes: string[];
  channels: StrategyChannel[];
};

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
  scheduledAt: string;
  score: string | null;
  htScore: string | null;
  phase: ModelRunPhase;
  channel: StrategyChannel;
  status: ChannelDecisionStatus;
  reasonCode: string | null;
  reasonDetails: unknown;
  // Model↔market coherence gate flag on the underlying ModelRun — when true
  // the whole fixture is excluded from the staking pool.
  calibrationAlert: boolean;
  selections: ChannelSelectionDto[];
};

export type ChannelDecisionMatchDecisionDto = Pick<
  ChannelDecisionDto,
  | "id"
  | "modelRunId"
  | "phase"
  | "channel"
  | "status"
  | "reasonCode"
  | "reasonDetails"
  | "calibrationAlert"
  | "selections"
>;

export type ChannelDecisionMatchDto = Pick<
  ChannelDecisionDto,
  | "fixtureId"
  | "competition"
  | "country"
  | "homeTeam"
  | "awayTeam"
  | "homeLogo"
  | "awayLogo"
  | "kickoff"
  | "scheduledAt"
  | "score"
  | "htScore"
> & {
  selectedCount: number;
  decisions: ChannelDecisionMatchDecisionDto[];
};

export type ChannelDecisionChannelGroupDto = {
  channel: StrategyChannel;
  decisions: ChannelDecisionDto[];
};

export type ChannelDecisionFilters = {
  competition?: string;
  channel?: StrategyChannel;
  market?: string;
  status?: ChannelDecisionStatus;
  phase?: ModelRunPhase;
};
