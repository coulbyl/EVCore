"use client";

import { BACKEND_URL, parseApiError } from "@/lib/api/shared";
import type { AnalysisSheetFilters } from "../types/analysis-sheet";

function buildQuery(
  filters: AnalysisSheetFilters,
  format: "txt" | "json",
): string {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    format,
  });
  if (filters.competitionCode)
    params.set("competitionCode", filters.competitionCode);
  if (filters.channel) params.set("channel", filters.channel);
  return params.toString();
}

// Not a TanStack Query hook: this is a one-off side-effecting download
// action, not cached/rendered data.
export async function downloadAnalysisSheet(
  filters: AnalysisSheetFilters,
  format: "txt" | "json",
): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/analysis-sheet?${buildQuery(filters, format)}`,
    { credentials: "include", cache: "no-store" },
  );

  if (!response.ok) {
    throw await parseApiError(
      response,
      "Impossible d'exporter la fiche d'analyse.",
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fiche-evcore-${filters.from}_${filters.to}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
