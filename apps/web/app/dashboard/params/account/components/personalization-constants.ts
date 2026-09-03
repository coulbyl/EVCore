export function formatCalibrationRatio(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(2)}×`;
}

export const RISK_PROFILE_VALUES = [
  "CONSERVATIVE",
  "BALANCED",
  "AGGRESSIVE",
] as const;

export type RiskProfileValue = (typeof RISK_PROFILE_VALUES)[number];
