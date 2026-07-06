"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@evcore/ui";
import { cn } from "@evcore/ui/cn";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnalyzeWithEva } from "@/domains/analysis-sheet/use-cases/use-analyze-with-eva";
import { downloadAnalysisSheet } from "@/domains/analysis-sheet/use-cases/use-export-analysis-sheet";
import type { AnalysisSheetFilters } from "@/domains/analysis-sheet/types/analysis-sheet";
import { EvaFilterBar } from "./eva-filter-bar";
import { EvaResultPanel } from "./eva-result-panel";
import { daysAheadIso, todayIso } from "@/lib/date";

// Discovery ping: shown only until the user opens Eva once.
const DISCOVERED_KEY = "evcore-eva-fab-discovered";

// Kill switch for the LLM call only (export .txt/.json stays available) —
// flip to "false" while the Groq TPM tier can't cover a full analysis request.
const ANALYSIS_ENABLED = process.env.NEXT_PUBLIC_EVA_ANALYSIS_ENABLED !== "false";

export function EvaFab() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // false on the server and first client render (no hydration mismatch, no
  // flash for returning users); flipped on after mount for first-timers.
  const [showPing, setShowPing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISCOVERED_KEY)) setShowPing(true);
  }, []);

  function handleOpen() {
    setOpen(true);
    if (showPing) {
      localStorage.setItem(DISCOVERED_KEY, "1");
      setShowPing(false);
    }
  }
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
        onClick={handleOpen}
        title="Eva"
        className={cn(
          "fixed bottom-24 left-4 z-30 flex size-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-accent via-accent to-accent/70 text-accent-foreground",
          "shadow-[0_8px_32px_rgba(15,23,42,0.35)] ring-1 ring-accent/40",
          "transition-transform hover:scale-105 active:scale-95",
          "md:bottom-6 md:left-auto md:right-6 md:size-12",
        )}
      >
        {showPing && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/50" />
        )}
        <Sparkles className="size-6 md:size-5" />
      </button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        direction={isMobile ? "bottom" : "right"}
      >
        <DrawerContent
          className={
            isMobile
              ? "z-50 flex h-[92dvh] min-h-0 flex-col rounded-t-[1.25rem] border-t border-border bg-panel outline-none"
              : "z-50 inset-y-4 right-4 flex h-[calc(100dvh-2rem)] w-[420px] flex-col rounded-2xl border border-border bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none"
          }
        >
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="size-5 text-accent" />
              Eva
            </DrawerTitle>
            <DrawerDescription>
              Génère une fiche des picks retenus sur une période, exportable en
              txt/json, ou analysée directement par Eva.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 pt-0">
            <EvaFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              onAnalyze={() => analyze.mutate(filters)}
              isAnalyzing={analyze.isPending}
              onExport={handleExport}
              analysisEnabled={ANALYSIS_ENABLED}
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
        </DrawerContent>
      </Drawer>
    </>
  );
}
