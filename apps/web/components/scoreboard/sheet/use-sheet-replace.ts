"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isPlainClick, isSheetPath } from "./sheet-constants";

/**
 * Une feuille à la fois, à l'écran comme dans l'historique. Pendant qu'une
 * feuille est ouverte, un lien vers une autre feuille la remplace au lieu
 * de s'empiler : un match ouvert dans la liste à côté (écran large), le
 * ticket depuis sa barre, un coupon depuis le détail d'un produit, le « ? »
 * d'une fiche. Refermer la suivante (croix, Échap, voile, geste ou bouton
 * retour du navigateur) ramène alors à l'écran sous la feuille, et non à la
 * précédente — sinon cinq matchs ouverts à la suite demandaient cinq
 * fermetures.
 *
 * Un seul écouteur au document, avant ceux de React : `next/link` voit le
 * clic déjà traité (`defaultPrevented`) et ne pousse rien. Un clic modifié
 * (nouvel onglet), un lien externe ou vers une vraie page passent tels quels.
 */
export function useSheetReplace(): void {
  const router = useRouter();
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || !isPlainClick(event)) return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      // Most links are root-relative (`next/link`): one that is no sheet is
      // let through before any URL is built.
      const raw = anchor.getAttribute("href") ?? "";
      if (
        raw.startsWith("/") &&
        !raw.startsWith("//") &&
        !isSheetPath(raw.split(/[?#]/, 1)[0] ?? "")
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!isSheetPath(url.pathname)) return;
      const href = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      event.preventDefault();
      // The sheet already open: nothing to add to the history.
      if (href === current) return;
      router.replace(href, { scroll: false });
    }
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [router]);
}
