"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@evcore/ui";
import { cn } from "@evcore/ui/cn";
import { useAnalyzeWithEva } from "@/domains/analysis-sheet/use-cases/use-analyze-with-eva";
import { downloadAnalysisSheet } from "@/domains/analysis-sheet/use-cases/use-export-analysis-sheet";
import type { AnalysisSheetFilters } from "@/domains/analysis-sheet/types/analysis-sheet";
import { EvaFilterBar } from "./eva-filter-bar";
import { EvaResultPanel } from "./eva-result-panel";
import { daysAheadIso, todayIso } from "@/lib/date";

export function EvaFab() {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<AnalysisSheetFilters>({
    from: todayIso(),
    to: daysAheadIso(7),
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Eva"
        className={cn(
          "fixed bottom-24 left-4 z-30 flex size-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-accent via-accent to-accent/70 text-accent-foreground",
          "shadow-[0_8px_32px_rgba(15,23,42,0.35)] ring-1 ring-accent/40",
          "transition-transform hover:scale-105 active:scale-95",
          "md:bottom-6 md:left-auto md:right-6 md:size-12",
        )}
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/50" />
        <Sparkles className="size-6 md:size-5" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="size-5 text-accent" />
              Eva
            </SheetTitle>
            <SheetDescription>
              Génère une fiche des picks retenus sur une période, exportable en
              txt/json, ou analysée directement par Eva.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 p-4 pt-0">
            <EvaFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              onAnalyze={() => analyze.mutate(filters)}
              isAnalyzing={analyze.isPending}
              onExport={handleExport}
            />

            {exportError && (
              <p className="text-sm text-danger">{exportError}</p>
            )}

            <EvaResultPanel
              result={analyze.data ?? null}
              isPending={analyze.isPending}
              error={
                analyze.error instanceof Error ? analyze.error.message : null
              }
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
