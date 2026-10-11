"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@evcore/ui";
import { usePageTextSearch } from "./use-page-text-search";

/**
 * Recherche dans la page. Était un second bouton flottant, déplaçable et
 * mémorisé, qui dépassait du bord droit en mobile et se posait sur le menu
 * en desktop (revue UX du 2026-10-11, P1-8). C'est désormais un bouton de
 * l'en-tête, desktop seulement : en mobile la navigation basse et Eva
 * occupent déjà l'écran, et le navigateur sait chercher dans la page.
 */
export function PageSearchButton() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = usePageTextSearch(open);

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

  return (
    <>
      {/* Next's CSS pipeline (Lightning CSS) rejects ::highlight() as an
          unknown pseudo-element in globals.css, so it's inlined here instead
          of processed through the bundler. */}
      <style>{`
        ::highlight(page-search-match) { background-color: #fde047; color: #111827; }
        ::highlight(page-search-match-active) { background-color: #f97316; color: #ffffff; }
      `}</style>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Rechercher dans la page"
        aria-label="Rechercher dans la page"
        data-tour="page-search-fab"
        className="hidden size-9 items-center justify-center rounded-xl border border-border bg-panel-strong text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:flex"
      >
        <Search className="size-4" />
      </button>

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
