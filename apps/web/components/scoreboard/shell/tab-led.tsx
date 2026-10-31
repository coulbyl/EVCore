// clsx, not cn: also drawn by the player's client components, where
// tailwind-merge weighed 8.6 kio of JS (C0). A `className` passed in adds
// classes, it never overrides one of these.
import { clsx as cn } from "clsx";

/**
 * La petite diode allumée de l'onglet actif. Décorative : l'état actif est
 * porté par `aria-current` et par le contraste du libellé.
 */
export function TabLed({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block size-1.5 rounded-full border border-led-on-edge bg-led-on",
        className,
      )}
    />
  );
}
