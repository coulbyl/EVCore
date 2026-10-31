// clsx alone: it also renders in the ticket's client sheet, and no caller
// passes a class that tailwind-merge would have to resolve (C0).
import { clsx as cn } from "clsx";

/**
 * Les diodes de chance : « 8 sur 10 », « 1 fois sur 9 » (13-style.md § 5).
 * Allumées en ambre, éteintes en anneau gris sur fond clair, en disque sur
 * l'encre du bandeau ou en sombre.
 *
 * Toujours accompagnées du nombre écrit : les diodes le redoublent, elles ne
 * le remplacent pas. `label` est ce nombre en toutes lettres pour les
 * lecteurs d'écran (« 8 chances sur 10 »).
 */
/** The whole lighting, first diode to last (13-style.md § 5). */
const LIGHT_UP_MS = 300;

const SIZES = {
  sm: { dot: "size-2.5", gap: "gap-1" },
  md: { dot: "size-3.5", gap: "gap-1.5" },
  lg: { dot: "size-[1.375rem]", gap: "gap-2" },
} as const;

export function ChanceLeds({
  lit,
  total = 10,
  label,
  tone = "surface",
  size = "md",
  lightUp = false,
  className,
}: {
  lit: number;
  total?: number;
  label: string;
  /** `band` : posées sur l'encre du bandeau ou d'une feuille. */
  tone?: "surface" | "band";
  size?: keyof typeof SIZES;
  /**
   * Aujourd'hui's hero only (13-style.md § 5, the app's one motion): the lit
   * diodes light up left to right once, in 300 ms; none under reduced
   * motion.
   */
  lightUp?: boolean;
  className?: string;
}) {
  const count = Math.max(1, Math.round(total));
  const on = Math.min(count, Math.max(0, Math.round(lit)));
  const { dot, gap } = SIZES[size];

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex flex-wrap items-center", gap, className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          aria-hidden
          style={
            lightUp && index < on
              ? {
                  animationDelay: `${Math.round((index * LIGHT_UP_MS) / on)}ms`,
                }
              : undefined
          }
          className={cn(
            lightUp &&
              index < on &&
              "animate-led-light motion-reduce:animate-none",
            "block shrink-0 rounded-full border",
            dot,
            index < on
              ? tone === "band"
                ? "border-led-on bg-led-on"
                : "border-led-on-edge bg-led-on"
              : tone === "band"
                ? "border-led-off-band bg-led-off-band"
                : "border-led-off-edge bg-led-off",
          )}
        />
      ))}
    </span>
  );
}
