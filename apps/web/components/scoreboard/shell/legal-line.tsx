// clsx, not cn: also drawn by the player's client components, where
// tailwind-merge weighed 8.6 kio of JS (C0). A `className` passed in adds
// classes, it never overrides one of these.
import { clsx as cn } from "clsx";

/**
 * « 18+ · Parier comporte des risques de perte », en pied de chaque écran du
 * joueur (10-transverse.md § 5). Toujours la même, jamais masquée, jamais
 * plus grande.
 */
export function LegalLine({
  text,
  className,
}: {
  /** `shell.legal`, translated by the caller (server or player texts). */
  text: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-4 py-4 text-center text-legal text-muted-foreground",
        className,
      )}
    >
      {text}
    </p>
  );
}
