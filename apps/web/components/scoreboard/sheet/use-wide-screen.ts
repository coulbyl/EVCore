"use client";

import { useSyncExternalStore } from "react";
import { WIDE_SCREEN_QUERY } from "./sheet-constants";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Vrai à partir de 1024 px. Côté serveur, faux : la mise en forme est en CSS
 * (`lg:`), seul le comportement modal attend l'hydratation pour savoir s'il
 * s'applique.
 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_SCREEN_QUERY).matches,
    () => false,
  );
}
