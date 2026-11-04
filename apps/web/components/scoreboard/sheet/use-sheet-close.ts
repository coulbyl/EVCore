"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { hasInAppHistory } from "./in-app-history";

/**
 * Refermer une feuille, c'est revenir en arrière : elle s'ouvre par une
 * navigation interceptée (`@sheet/(.)…`), et le bouton retour du téléphone
 * doit la refermer de la même façon. Sans historique (onglet ouvert sur
 * l'adresse de la feuille, lien partagé), on remplace l'adresse par
 * `fallbackHref`, l'écran sous la feuille : revenir en arrière sortirait du
 * site, et une entrée poussée rouvrirait la feuille au retour du navigateur.
 * L'écran sous la feuille garde son défilement ; `scroll: true` pour une
 * page qui en remplace une autre (BackLink).
 */
export function useSheetClose(
  fallbackHref: string,
  options: { scroll?: boolean } = {},
): () => void {
  const router = useRouter();
  const scroll = options.scroll ?? false;
  return useCallback(() => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.replace(fallbackHref, { scroll });
    }
  }, [router, fallbackHref, scroll]);
}
