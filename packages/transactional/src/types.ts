export type RenderedEmail = {
  html: string;
  text: string;
};

export type RoiAlertProps = {
  market: string;
  roi: number;
  betCount: number;
};

export type MarketSuspensionProps = {
  market: string;
  roi: number;
  betCount: number;
};

export type BrierAlertProps = {
  seasonId: string;
  brierScore: number;
};

export type EtlFailureProps = {
  queue: string;
  jobName: string;
  errorMessage: string;
};

export type WeightAdjustmentProps = {
  proposalId: string;
  isRollback: boolean;
  brierScore?: number;
  meanError?: number;
  rolledBackProposalId?: string;
};

export type WeeklyReportProps = {
  roiOneXTwo: number;
  betsPlaced: number;
  brierScore: number;
  periodStart: string;
  periodEnd: string;
};

export type XgUnavailableReportProps = {
  season: string; // e.g. "2022-23"
  unavailableCount: number;
  externalIds: number[];
};

export type DailyCouponLeg = {
  homeTeam: string;
  awayTeam: string;
  scheduledAt: string;
  market: string;
  pick: string;
  odds: number | null;
  ev: number;
  comboMarket: string | null;
  comboPick: string | null;
};

export type DailyCouponProps = {
  couponId: string;
  date: string;
  legCount: number;
  tier?: "PREMIUM" | "STANDARD" | "SPECULATIF" | "SAFE" | null;
  legs: DailyCouponLeg[];
};
