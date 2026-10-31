// clsx, not cn: also drawn by the player's client components, where
// tailwind-merge weighed 8.6 kio of JS (C0). A `className` passed in adds
// classes, it never overrides one of these.
import { clsx as cn } from "clsx";

/**
 * Une ligne d'état (10-transverse.md § 2) : ce qui manque ou ce qui ne va
 * pas, en une phrase, et toujours une issue à côté (`action`) : où aller,
 * quoi toucher, quand revenir. Elle remplace un contenu, elle ne s'y ajoute
 * pas.
 *
 * Utilisée pour le vide (« Rien à jouer aujourd'hui »), l'erreur (« On
 * n'arrive pas à charger · Réessayer »), le hors-ligne et la mise à jour.
 */
export function StateLine({
  children,
  action,
  role,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  /** `status` pour annoncer un changement (hors ligne), `alert` pour une erreur. */
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-body",
        className,
      )}
    >
      <span className="min-w-0">{children}</span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}

/** L'issue d'une ligne d'état, en bouton ou en lien : même apparence. */
export const stateActionClass =
  "inline-flex min-h-11 items-center rounded-md px-1 font-medium underline underline-offset-4 decoration-1 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
