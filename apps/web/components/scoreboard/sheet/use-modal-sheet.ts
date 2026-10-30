"use client";

import { useEffect, useRef, type RefObject } from "react";
import { FOCUSABLE_SELECTOR, SHEET_INERT_ATTRIBUTE } from "./sheet-constants";

/**
 * Ce qu'une feuille doit au clavier et aux lecteurs d'écran.
 *
 * Toujours : le focus entre dans la feuille à l'ouverture, Échap la referme,
 * le focus revient à l'élément qui l'a ouverte à la fermeture.
 * Modale seulement (téléphone, tablette) : le reste de l'écran devient
 * inerte, le défilement de la page est bloqué, Tab tourne dans la feuille.
 */
export function useModalSheet({
  panelRef,
  modal,
  onClose,
}: {
  panelRef: RefObject<HTMLElement | null>;
  modal: boolean;
  onClose: () => void;
}): void {
  // L'élément qui a ouvert la feuille, retenu une seule fois : en mode
  // strict (développement), React monte, démonte puis remonte le composant,
  // et au second montage l'élément actif est déjà la feuille elle-même.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const active = document.activeElement;
    if (
      !openerRef.current &&
      active instanceof HTMLElement &&
      !panel?.contains(active)
    ) {
      openerRef.current = active;
    }
    panel?.focus({ preventScroll: true });
    return () => {
      // À l'image suivante : l'effet qui rend l'arrière-plan inerte se
      // nettoie après celui-ci, et un élément inerte refuse le focus. Si la
      // feuille est toujours là (remontage), elle garde le focus.
      requestAnimationFrame(() => {
        if (panel?.isConnected) return;
        const opener = openerRef.current;
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      });
    };
  }, [panelRef]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // Déjà traité (un menu, une notification), ou, sur écran large où la
        // feuille n'est qu'une colonne, appuyé ailleurs que dans la feuille :
        // ce n'est pas pour elle.
        if (event.defaultPrevented) return;
        const panel = panelRef.current;
        if (!modal && !panel?.contains(document.activeElement)) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (!modal || event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = [
        ...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal, onClose, panelRef]);

  useEffect(() => {
    if (!modal) return;
    const background = [
      ...document.querySelectorAll<HTMLElement>(`[${SHEET_INERT_ATTRIBUTE}]`),
    ];
    for (const element of background) element.inert = true;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      for (const element of background) element.inert = false;
      root.style.overflow = previousOverflow;
    };
  }, [modal]);
}
