"use client";

import { useState } from "react";
import { PageHeader, PageHeaderTitle } from "@evcore/ui";
import { useAnalyzeWithEva } from "@/domains/analysis-sheet/use-cases/use-analyze-with-eva";
import { downloadAnalysisSheet } from "@/domains/analysis-sheet/use-cases/use-export-analysis-sheet";
import type { AnalysisSheetFilters } from "@/domains/analysis-sheet/types/analysis-sheet";
import { DateRangeFilterBar } from "./date-range-filter-bar";
import { AnalysisResultPanel } from "./analysis-result-panel";
import { daysAgoIso, todayIso } from "./analysis-sheet-constants";

export function AnalysisSheetPageClient() {
  const [filters, setFilters] = useState<AnalysisSheetFilters>({
    from: daysAgoIso(7),
    to: todayIso(),
  });
  const [exportError, setExportError] = useState<string | null>(null);
  const analyze = useAnalyzeWithEva();

  async function handleExport(format: "txt" | "json") {
    setExportError(null);
    try {
      await downloadAnalysisSheet(filters, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export impossible.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader>
        <div>
          <PageHeaderTitle className="text-xl font-bold">
            Fiche d&apos;analyse
          </PageHeaderTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Génère une fiche des picks retenus sur une période, exportable en
            txt/json, ou analysée directement par Eva.
          </p>
        </div>
      </PageHeader>

      <DateRangeFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onAnalyze={() => analyze.mutate(filters)}
        isAnalyzing={analyze.isPending}
        onExport={handleExport}
      />

      {exportError && <p className="text-sm text-danger">{exportError}</p>}

      <AnalysisResultPanel
        result={analyze.data ?? null}
        isPending={analyze.isPending}
        error={analyze.error instanceof Error ? analyze.error.message : null}
      />
    </div>
  );
}
