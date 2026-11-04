"use client";

import { usePathname, useRouter } from "next/navigation";
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
/** L'écran d'avant et l'écran courant, vus par le suivi (sans l'API Navigation). */
let previousPathname: string | null = null;
let currentPathname: string | null = null;
const listeners = new Set<() => void>();
/** A sheet to open once the screen under it is shown (`openOver`). */
let sheetToOpen: { under: string; href: string } | null = null;

type NavigationLike = {
  currentEntry?: { index: number } | null;
  entries?: () => { url: string | null }[];
};

function navigationApi(): NavigationLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { navigation?: NavigationLike }).navigation;
}

function currentEntryIndex(): number | null {
  const index = navigationApi()?.currentEntry?.index;
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

/**
 * L'écran où revenir en arrière mène (son chemin), ou null quand revenir
 * sortirait de l'application. Avec l'API Navigation, l'entrée d'avant
 * exactement ; sans elle, l'écran vu juste avant (faux après un retour du
 * navigateur, comme le compteur).
 */
export function previousInAppPathname(): string | null {
  if (!hasInAppHistory()) return null;
  const index = currentEntryIndex();
  const entries = navigationApi()?.entries?.();
  if (index !== null && entries) {
    const url = entries[index - 1]?.url;
    return url ? new URL(url).pathname : null;
  }
  return previousPathname;
}

/** Prévient à chaque changement d'écran suivi (le libellé du retour). */
export function subscribeInAppHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Puts `under` in place of the current address, then opens the sheet
 * `href` over it, as a tap in that screen would: the history ends with the
 * screen, then the sheet. Two navigations in a row would not do: the second
 * cancels the first, and the sheet is laid over the screen being left.
 */
export function openOver(
  router: { replace: (href: string) => void },
  { under, href }: { under: string; href: string },
): void {
  sheetToOpen = { under, href };
  router.replace(under);
}

/**
 * Posé une fois à la racine (joueur comme visiteur) : suit chaque
 * changement d'écran.
 */
export function InAppHistoryTracker(): null {
  const pathname = usePathname();
  const router = useRouter();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      firstEntryIndex ??= currentEntryIndex();
    } else {
      inAppNavigations += 1;
      previousPathname = currentPathname;
    }
    currentPathname = pathname;
    listeners.forEach((listener) => listener());
    if (sheetToOpen?.under === pathname) {
      const { href } = sheetToOpen;
      sheetToOpen = null;
      router.push(href);
    }
  }, [pathname, router]);
  return null;
}
