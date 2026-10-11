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
import { downloadAnalysisSheet } from "@/domains/analysis-sheet/use-cases/use-export-analysis-sheet";
import type { AnalysisSheetFilters } from "@/domains/analysis-sheet/types/analysis-sheet";
import { EvaFilterBar } from "./eva-filter-bar";
import { daysAheadIso, todayIso } from "@/lib/date";

// Discovery ping: shown only until the user opens Eva once.
const DISCOVERED_KEY = "evcore-eva-fab-discovered";

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
      {/* Un seul bouton flottant, ancré à droite au-dessus de la barre de
          navigation basse en mobile et dans le coin bas-droit en desktop.
          Il était déplaçable et mémorisé : sa position finissait sur le
          menu « Accueil » en desktop et sur les titres en mobile, avec un
          second bouton flottant pour la recherche (revue UX du 2026-10-11,
          P1-8). La recherche dans la page vit désormais dans l'en-tête. */}
      <button
        type="button"
        onClick={handleOpen}
        title="Eva"
        aria-label="Ouvrir Eva"
        data-tour="eva-fab"
        className={cn(
          "fixed z-30 flex size-11 items-center justify-center rounded-full md:size-12",
          "right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-6",
          "bg-gradient-to-br from-accent via-accent to-accent/70 text-accent-foreground",
          "shadow-[0_6px_24px_rgba(15,23,42,0.28)] ring-1 ring-accent/40",
          "transition-transform hover:scale-105 active:scale-95",
        )}
      >
        {showPing && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/50" />
        )}
        <Sparkles className="size-5" />
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
              txt ou json.
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 pt-0">
            <EvaFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              onExport={handleExport}
            />

            {exportError && (
              <p className="text-sm text-danger">{exportError}</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
