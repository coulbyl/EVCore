"use client";

import { useMutation } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  AnalysisSheetFilters,
  AnalyzeWithEvaResult,
} from "../types/analysis-sheet";

export function useAnalyzeWithEva() {
  return useMutation({
    mutationFn: (filters: AnalysisSheetFilters) =>
      clientApiRequest<AnalyzeWithEvaResult>("/analysis-sheet/analyze", {
        method: "POST",
        body: filters,
        fallbackErrorMessage: "Impossible d'analyser la fiche avec Eva.",
      }),
  });
}
