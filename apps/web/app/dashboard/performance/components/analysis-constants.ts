import type { BacktestVerdict } from "@/domains/backtest/types/channel-backtest";

export const ANALYSIS_STORAGE_KEY = {
  channels: "evcore:performance-channel-backtest",
  calibration: "evcore:performance-model-calibration",
  tuning: "evcore:performance-channel-tuning",
} as const;

/** Signed percentage (e.g. ROI). `—` for nullish/NaN. */
export function formatSignedPct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const scaled = value * 100;
  return `${scaled > 0 ? "+" : ""}${scaled.toFixed(digits)}%`;
}

/** Unsigned percentage (e.g. hit rate, coverage). */
export function formatPct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function roiToneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-muted-foreground";
  }
  return value >= 0 ? "text-success" : "text-danger";
}

export function verdictToneClass(verdict: BacktestVerdict): string {
  if (verdict === "PASS") return "border-success/40 text-success";
  if (verdict === "FAIL") return "border-danger/40 text-danger";
  return "border-border text-muted-foreground";
}
