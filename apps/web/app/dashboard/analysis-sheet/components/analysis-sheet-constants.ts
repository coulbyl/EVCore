import type { AnalysisSheetChannel } from "@/domains/analysis-sheet/types/analysis-sheet";

export const ANALYSIS_SHEET_CHANNEL_OPTIONS: {
  value: AnalysisSheetChannel;
  label: string;
}[] = [
  { value: "VALUE", label: "Valeur" },
  { value: "SAFE", label: "Sécurité" },
  { value: "DOMINANT", label: "Victoire" },
  { value: "BTTS", label: "BB" },
  { value: "DRAW", label: "Nul" },
  { value: "GOALS", label: "Buts" },
];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
