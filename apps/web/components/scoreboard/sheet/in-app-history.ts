"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Navigations faites dans l'application depuis le chargement de la page.
 * Vit le temps du document : un chargement complet (lien partagé, nouvel
 * onglet) repart de zéro. `window.history.length` ne suffit pas : il compte
 * aussi les pages d'autres sites ouvertes avant dans le même onglet.
 */
let inAppNavigations = 0;

/** Vrai si revenir en arrière reste dans l'application. */
export function hasInAppHistory(): boolean {
  return inAppNavigations > 0;
}

/** Posé une fois dans la coquille du joueur : compte chaque changement d'écran. */
export function InAppHistoryTracker(): null {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    inAppNavigations += 1;
  }, [pathname]);
  return null;
}
