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
 */
export function useSheetClose(fallbackHref: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.replace(fallbackHref, { scroll: false });
    }
  }, [router, fallbackHref]);
}
