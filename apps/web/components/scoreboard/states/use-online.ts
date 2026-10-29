"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Vrai tant que le téléphone a du réseau. Les gestes qui écrivent (Suivre,
 * Partager, envoyer un message) s'en servent pour se griser hors ligne
 * (10-transverse.md § 2). Côté serveur, on suppose le réseau présent.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
