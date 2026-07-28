export type SubscriptionSourceType =
  | "COUPON_BEST"
  | "COUPON_ALL"
  | "CHANNEL_VALUE"
  | "CHANNEL_SAFE"
  | "CHANNEL_DOMINANT"
  | "CHANNEL_DRAW"
  | "CHANNEL_BTTS"
  | "CHANNEL_TEAM_TOTAL";

export type SubscriptionChannelPickMode = "INVESTIR" | "DECISIONS";

export type SubscriptionStatus = "ACTIVE" | "ENDED" | "CANCELLED";

export type SubscriptionSourceDef = {
  id: SubscriptionSourceType;
  label: string;
  kind: "COUPON" | "CHANNEL";
  channel?: string;
  investmentMode?: string;
};

export type SubscriptionChannelPickModeDef = {
  id: SubscriptionChannelPickMode;
  label: string;
};

export type SubscriptionLeaguePreset = {
  id: string;
  label: string;
  competitionCodes: string[];
};

export type SubscriptionCompetitionOption = {
  code: string;
  name: string;
  country: string;
};

export type SubscriptionWeekday = { value: number; label: string };

export type SubscriptionCatalog = {
  sources: SubscriptionSourceDef[];
  channelPickModes: SubscriptionChannelPickModeDef[];
  topNOptions: number[];
  leaguePresets: SubscriptionLeaguePreset[];
  weekdays: SubscriptionWeekday[];
  competitions: SubscriptionCompetitionOption[];
};

export type Subscription = {
  id: string;
  sourceType: SubscriptionSourceType;
  sourceLabel: string;
  channelPickMode: SubscriptionChannelPickMode | null;
  topN: number | null;
  stakePerEvent: string;
  daysOfWeek: number[];
  competitionCodes: string[];
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  cancelledAt: string | null;
  totalEvents: number;
  settledEvents: number;
  wonEvents: number;
  totalStaked: string;
  netPnl: string;
  roiPct: string | null;
  createdAt: string;
};

export type SubscriptionEvent = {
  id: string;
  date: string;
  label: string;
  stake: string;
  odds: string | null;
  result: "WON" | "LOST" | "VOID" | null;
  pnl: string | null;
  settledAt: string | null;
};

export type SubscriptionDetail = Subscription & {
  events: SubscriptionEvent[];
};

export type CreateSubscriptionInput = {
  sourceType: SubscriptionSourceType;
  channelPickMode: SubscriptionChannelPickMode | null;
  topN: number | null;
  stakePerEvent: number;
  daysOfWeek: number[];
  competitionCodes: string[];
  startDate: string;
  endDate: string;
};
