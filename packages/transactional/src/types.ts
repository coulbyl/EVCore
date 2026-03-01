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
