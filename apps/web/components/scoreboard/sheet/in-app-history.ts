"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Revenir en arrière reste-t-il dans l'application ? Compté depuis le
 * chargement du document : un chargement complet (lien partagé, nouvel
 * onglet, rechargement) repart de zéro. `window.history.length` ne suffit
 * pas : il compte aussi les pages d'autres sites ouvertes avant dans le même
 * onglet, et les entrées en avant.
 *
 * Avec l'API Navigation (Chromium, Safari 26.2+), la position de l'entrée
 * courante dit exactement où l'on est, retour et avance du navigateur
 * compris. Sans elle, un compteur de changements d'écran, qui ne distingue
 * pas un retour d'une avance : il peut se croire en profondeur après un
 * retour du navigateur.
 */
let inAppNavigations = 0;
/** La position, dans l'historique, de l'entrée sur laquelle le document a chargé. */
let firstEntryIndex: number | null = null;

type NavigationLike = { currentEntry?: { index: number } | null };

function currentEntryIndex(): number | null {
  if (typeof window === "undefined") return null;
  const navigation = (window as { navigation?: NavigationLike }).navigation;
  const index = navigation?.currentEntry?.index;
  return typeof index === "number" && index >= 0 ? index : null;
}

/** Vrai si revenir en arrière reste dans l'application. */
export function hasInAppHistory(): boolean {
  const index = currentEntryIndex();
  if (index !== null && firstEntryIndex !== null) {
    return index > firstEntryIndex;
  }
  return inAppNavigations > 0;
}

/** Posé une fois dans la coquille du joueur : suit chaque changement d'écran. */
export function InAppHistoryTracker(): null {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      firstEntryIndex ??= currentEntryIndex();
      return;
    }
    inAppNavigations += 1;
  }, [pathname]);
  return null;
}
