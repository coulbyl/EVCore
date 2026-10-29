import { cn } from "@evcore/ui/cn";

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
