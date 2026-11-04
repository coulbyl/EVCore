"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  hasInAppHistory,
  openOver,
  previousInAppPathname,
  subscribeInAppHistory,
} from "../sheet/in-app-history";
import { isPlainClick } from "../sheet/sheet-constants";
import { backLabelOf, type BackPlaces } from "./back-places";

/**
 * Le retour d'une page (un sous-écran de Moi, la cloche, l'analyse d'un
 * match, un écran du visiteur) : là d'où l'on vient, comme le bouton retour
 * du navigateur, et non une nouvelle entrée qui ferait revenir sur la page
 * au retour suivant. Sans historique (lien direct, rechargement), on
 * remplace l'adresse par `href`, l'écran parent.
 *
 * Le libellé dit où il mène vraiment : l'écran d'avant, nommé par `places`
 * (« Retour aux résultats »), ou le parent sans historique (`label`, sinon
 * son nom dans `places`) ; « Retour » pour un écran sans nom.
 *
 * Un parent qui s'ouvre en feuille (le match, sous son analyse) se pose sur
 * `under`, l'écran sous la feuille : l'adresse de la page est remplacée par
 * celle de l'écran, puis la feuille s'ouvre par-dessus, comme d'un toucher
 * dans la liste. Naviguer droit vers la feuille depuis la page serait
 * intercepté et la poserait sur la page qu'on quitte.
 */
export function BackLink({
  href,
  under,
  label,
  places,
  className,
  children,
}: {
  href: string;
  /** `href` opens in a sheet: the screen it is laid over. */
  under?: string;
  /** The parent's name, when `places` does not say it (« Retour au match »). */
  label?: string;
  /** The screens it can name, and « Retour » for the others. */
  places: BackPlaces;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const shown = useSyncExternalStore(
    subscribeInAppHistory,
    () =>
      backLabelOf({ previous: previousInAppPathname(), href, label, places }),
    () => backLabelOf({ previous: null, href, label, places }),
  );
  return (
    <Link
      href={href}
      aria-label={shown}
      className={className}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        if (hasInAppHistory()) {
          router.back();
        } else if (under) {
          openOver(router, { under, href });
        } else {
          router.replace(href);
        }
      }}
    >
      {children}
    </Link>
  );
}
