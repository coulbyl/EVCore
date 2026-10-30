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

export type EmailVerificationProps = {
  firstName: string;
  code: string;
  expiresInMinutes: number;
};

export type EmailChangeCodeProps = {
  firstName: string;
  code: string;
  expiresInMinutes: number;
};

export type EmailChangedProps = {
  firstName: string;
  /** Nouvelle adresse, masquée (« f***@exemple.com »). */
  newEmail: string;
};

export type PasswordResetProps = {
  firstName: string;
  resetUrl: string;
  expiresInMinutes: number;
  isAdminGenerated: boolean;
};

export type MlModelActivatedProps = {
  versionId: string;
  segment: string;
  algorithm: string;
  brierScore: number;
  calibrationError: number;
  roiSimulated: number;
  isRollback: boolean;
  rolledBackVersionId?: string;
};

export type MlModelMissingProps = {
  segments: string[];
};

export type SupportMessageProps = {
  // Who this email is addressed to.
  recipientKind: "ADMIN" | "USER";
  fromUsername: string;
  preview: string;
};
