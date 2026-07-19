"use client";

import { useEffect, useRef, useState } from "react";
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
const FAB_POSITION_KEY = "evcore-eva-fab-position";
const HIDDEN_KEY = "evcore-eva-fab-hidden";
const DRAG_THRESHOLD_PX = 6;
// Held longer than this without dragging past the threshold = hide, not open.
const LONG_PRESS_MS = 500;
const NUB_WIDTH = 28;
const NUB_HEIGHT = 48;

type FabPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  hasDragged: boolean;
};

function getFabBounds() {
  const isDesktop = window.innerWidth >= 768;
  const size = isDesktop ? 48 : 44;
  const marginX = isDesktop ? 24 : 12;
  const marginY = isDesktop ? 24 : 112;

  return {
    marginX,
    marginY,
    maxX: Math.max(marginX, window.innerWidth - size - marginX),
    maxY: Math.max(marginY, window.innerHeight - size - marginY),
  };
}

function clampFabPosition(position: FabPosition) {
  const bounds = getFabBounds();

  return {
    x: Math.min(Math.max(position.x, bounds.marginX), bounds.maxX),
    y: Math.min(Math.max(position.y, bounds.marginY), bounds.maxY),
  };
}

function getDefaultFabPosition() {
  const bounds = getFabBounds();
  const isDesktop = window.innerWidth >= 768;

  return {
    x: isDesktop ? bounds.maxX : bounds.marginX,
    y: bounds.maxY,
  };
}

// The nub sticks to whichever edge the Fab was last closest to, at the same
// height — so restoring it feels like picking up where it was left.
function isNearLeftEdge(x: number): boolean {
  return x < window.innerWidth / 2;
}

export function EvaFab() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // false on the server and first client render (no hydration mismatch, no
  // flash for returning users); flipped on after mount for first-timers.
  const [showPing, setShowPing] = useState(false);
  const [position, setPosition] = useState<FabPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem(DISCOVERED_KEY)) setShowPing(true);
    if (localStorage.getItem(HIDDEN_KEY)) setHidden(true);

    const rawPosition = localStorage.getItem(FAB_POSITION_KEY);

    if (!rawPosition) {
      setPosition(getDefaultFabPosition());
      return;
    }

    try {
      const parsed = JSON.parse(rawPosition) as Partial<FabPosition>;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        setPosition(clampFabPosition({ x: parsed.x, y: parsed.y }));
        return;
      }
    } catch {
      // Ignore corrupted storage and restore the default placement.
    }

    setPosition(getDefaultFabPosition());
  }, []);

  useEffect(() => {
    if (!position) return;
    localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    if (!position) return;

    function handleResize() {
      setPosition((currentPosition) =>
        currentPosition ? clampFabPosition(currentPosition) : currentPosition,
      );
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  // Clear any pending long-press timer on unmount so it never fires (and
  // calls setState) after the component is gone.
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  function hideEva() {
    setHidden(true);
    setOpen(false);
    localStorage.setItem(HIDDEN_KEY, "1");
  }

  function showEva() {
    setHidden(false);
    localStorage.removeItem(HIDDEN_KEY);
  }

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

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!position) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      hasDragged: false,
    };

    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      hideEva();
    }, LONG_PRESS_MS);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const nextPosition = clampFabPosition({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    });

    if (
      !dragState.hasDragged &&
      Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX
    ) {
      dragState.hasDragged = true;
      setIsDragging(true);
      // A real drag started — this isn't a long press anymore.
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    setPosition(nextPosition);
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    suppressClickRef.current =
      dragState.hasDragged || longPressFiredRef.current;
    longPressFiredRef.current = false;
    dragStateRef.current = null;
    setIsDragging(false);
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    handleOpen();
  }

  return (
    <>
      {hidden && position && (
        <button
          type="button"
          onClick={showEva}
          aria-label="Afficher Eva"
          title="Afficher Eva"
          className={cn(
            "fixed z-30 flex items-center justify-center",
            "bg-gradient-to-br from-accent via-accent to-accent/70 text-accent-foreground",
            "shadow-[0_6px_24px_rgba(15,23,42,0.28)] ring-1 ring-accent/40",
            "opacity-60 transition-opacity hover:opacity-100",
            isNearLeftEdge(position.x)
              ? "left-0 rounded-r-xl"
              : "right-0 rounded-l-xl",
          )}
          style={{
            top: `${position.y}px`,
            width: NUB_WIDTH,
            height: NUB_HEIGHT,
          }}
        >
          <Sparkles className="size-4" />
        </button>
      )}

      {!hidden && (
        <button
          type="button"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          title="Eva (appui long pour masquer)"
          className={cn(
            "fixed z-30 flex size-11 items-center justify-center rounded-full md:size-12",
            "bg-gradient-to-br from-accent via-accent to-accent/70 text-accent-foreground",
            "shadow-[0_6px_24px_rgba(15,23,42,0.28)] ring-1 ring-accent/40",
            isDragging
              ? "cursor-grabbing touch-none transition-none"
              : "cursor-grab touch-none transition-transform hover:scale-105 active:scale-95",
          )}
          style={
            position
              ? {
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                }
              : { visibility: "hidden" }
          }
        >
          {showPing && (
            <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-accent/50" />
          )}
          <Sparkles className="size-5" />
        </button>
      )}

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
