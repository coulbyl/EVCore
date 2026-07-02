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
