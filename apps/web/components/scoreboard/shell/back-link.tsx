"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasInAppHistory } from "../sheet/in-app-history";
import { isSheetPath } from "../sheet/sheet-constants";

/**
 * Le retour d'une page sous un onglet : là d'où l'on vient, comme le bouton
 * retour du navigateur, et non une nouvelle entrée qui ferait revenir sur la
 * page au retour suivant. Sans historique (lien direct, rechargement), on
 * remplace l'adresse par `href`, l'écran parent.
 *
 * Un parent qui s'ouvre en feuille (le match, sous son analyse) se charge en
 * entier : naviguer vers lui depuis la page serait intercepté et poserait la
 * feuille par-dessus la page qu'on quitte. Chargé, c'est Matchs et sa
 * feuille.
 */
export function BackLink({
  href,
  label,
  className,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        if (hasInAppHistory()) {
          router.back();
        } else if (isSheetPath(href)) {
          window.location.replace(href);
        } else {
          router.replace(href);
        }
      }}
    >
      {children}
    </Link>
  );
}
