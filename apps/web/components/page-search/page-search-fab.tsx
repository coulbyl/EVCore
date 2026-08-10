"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@evcore/ui";
import { cn } from "@evcore/ui/cn";
import { usePageTextSearch } from "./use-page-text-search";

// Drag/position/hide behavior mirrors EvaFab (components/eva/eva-fab.tsx) —
// same nub-on-edge pattern — except this Fab starts hidden by default: it's
// a secondary tool, not the primary entry point Eva is.
// v2: moved to the opposite corner from EvaFab's default resting spot (see
// getDefaultFabPosition) — bumped so any already-saved v1 position, which
// could overlap EvaFab, is discarded in favor of the new corner.
const FAB_POSITION_KEY = "evcore-search-fab-position-v2";
const HIDDEN_KEY = "evcore-search-fab-hidden";
const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 500;
const NUB_WIDTH = 28;
const NUB_HEIGHT = 48;

type FabPosition = { x: number; y: number };

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

// Opposite corner from EvaFab's default (bottom-right desktop / bottom-left
// mobile) — stacking both on the same edge only offset vertically left them
// close enough on some viewports to overlap and swallow each other's
// long-press-to-hide gesture, so they get distinct corners instead.
function getDefaultFabPosition() {
  const bounds = getFabBounds();
  const isDesktop = window.innerWidth >= 768;
  return { x: isDesktop ? bounds.marginX : bounds.maxX, y: bounds.maxY };
}

function isNearLeftEdge(x: number): boolean {
  return x < window.innerWidth / 2;
}

export function PageSearchFab() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FabPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Hidden by default — only a first "reveal" (long press on the nub isn't
  // needed since there's nothing to reveal yet) or explicit show unhides it.
  const [hidden, setHidden] = useState(true);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = usePageTextSearch(open);

  useEffect(() => {
    setHidden(localStorage.getItem(HIDDEN_KEY) !== "0");

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
      setPosition((current) => (current ? clampFabPosition(current) : current));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function hideFab() {
    setHidden(true);
    setOpen(false);
    localStorage.setItem(HIDDEN_KEY, "1");
  }

  function showFab() {
    setHidden(false);
    localStorage.setItem(HIDDEN_KEY, "0");
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
      hideFab();
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
    setOpen((current) => !current);
  }

  return (
    <>
      {/* Next's CSS pipeline (Lightning CSS) rejects ::highlight() as an
          unknown pseudo-element in globals.css, so it's inlined here instead
          of processed through the bundler. */}
      <style>{`
        ::highlight(page-search-match) { background-color: #fde047; color: #111827; }
        ::highlight(page-search-match-active) { background-color: #f97316; color: #ffffff; }
      `}</style>

      {hidden && position && (
        <button
          type="button"
          onClick={showFab}
          aria-label="Afficher la recherche"
          title="Afficher la recherche"
          data-tour="page-search-fab"
          className={cn(
            "fixed z-30 flex items-center justify-center",
            "bg-panel-strong text-accent ring-2 ring-accent/40",
            "shadow-[0_6px_24px_rgba(15,23,42,0.35)]",
            "opacity-70 transition-opacity hover:opacity-100",
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
          <Search className="size-4" />
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
          title="Rechercher dans la page (appui long pour masquer)"
          data-tour="page-search-fab"
          className={cn(
            "fixed z-30 flex size-11 items-center justify-center rounded-full md:size-12",
            "bg-panel-strong text-accent ring-2 ring-accent/40",
            "shadow-[0_6px_24px_rgba(15,23,42,0.35)]",
            isDragging
              ? "cursor-grabbing touch-none transition-none"
              : "cursor-grab touch-none transition-transform hover:scale-105 active:scale-95",
          )}
          style={
            position
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : { visibility: "hidden" }
          }
        >
          <Search className="size-5" />
        </button>
      )}

      {open && (
        <div
          data-page-search-ignore
          className="fixed inset-0 z-50 flex items-center justify-center p-3 animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          {/* One fully opaque card start to finish — input row and status
              footer share the same solid surface, so there's never a
              translucent edge where page content underneath can bleed
              through and blend with the text (what happened with a bare
              InputGroup pill). */}
          <div
            className="w-full max-w-md animate-in fade-in zoom-in-95 overflow-hidden rounded-xl border-2 border-accent/50 bg-panel-strong shadow-[0_32px_80px_-8px_rgba(0,0,0,0.8)] ring-2 ring-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <InputGroup className="border-0 bg-panel-strong shadow-none">
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                ref={inputRef}
                value={search.query}
                onChange={(event) => search.setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (event.shiftKey) search.goPrev();
                    else search.goNext();
                  }
                }}
                placeholder="Rechercher dans la page…"
              />
              <InputGroupAddon align="inline-end">
                {search.query && (
                  <span className="text-xs tabular-nums whitespace-nowrap">
                    {search.matchCount > 0
                      ? `${search.activeIndex + 1}/${search.matchCount}`
                      : "0/0"}
                  </span>
                )}
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label="Occurrence précédente"
                  disabled={search.matchCount === 0}
                  onClick={() => search.goPrev()}
                >
                  <ChevronUp className="size-3.5" />
                </InputGroupButton>
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label="Occurrence suivante"
                  disabled={search.matchCount === 0}
                  onClick={() => search.goNext()}
                >
                  <ChevronDown className="size-3.5" />
                </InputGroupButton>
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label="Fermer la recherche"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-3.5" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {search.query && (
              <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {search.matchCount > 0
                  ? `${search.matchCount} correspondance${search.matchCount > 1 ? "s" : ""} trouvée${search.matchCount > 1 ? "s" : ""}.`
                  : "Aucun résultat trouvé."}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
