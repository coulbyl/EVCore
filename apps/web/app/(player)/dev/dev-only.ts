import { notFound } from "next/navigation";

/**
 * Les pages sous /dev servent au développement et à la revue (vitrine des
 * composants, banc des tests e2e) : en production elles n'existent pas.
 * Ce n'est pas un réglage, c'est l'environnement de compilation : leurs
 * fichiers `page.dev.tsx` ne sont des routes que hors production
 * (`pageExtensions` selon la phase, next.config.js). Ce garde double la règle si une page
 * de développement était un jour nommée `page.tsx` par erreur.
 */
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
}

/** Jamais indexées, même en développement exposé. */
export const devOnlyMetadata = {
  robots: { index: false, follow: false },
} as const;
