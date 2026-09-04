export const RISK_PROFILE_VALUES = [
  "CONSERVATIVE",
  "BALANCED",
  "AGGRESSIVE",
] as const;

export type RiskProfileValue = (typeof RISK_PROFILE_VALUES)[number];
