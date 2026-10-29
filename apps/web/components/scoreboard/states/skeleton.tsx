import { cn } from "@evcore/ui/cn";

/**
 * Un bloc gris à la place d'un contenu qui arrive (10-transverse.md § 2) :
 * jamais de roue au milieu d'un écran vide. La pulsation s'arrête si le
 * téléphone demande moins d'animations.
 */
export function Skeleton({
  className,
  tone = "surface",
}: {
  className?: string;
  /** `band` : sur l'encre du bandeau. */
  tone?: "surface" | "band";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block rounded-md motion-safe:animate-pulse",
        tone === "band" ? "bg-band-rule" : "bg-skeleton",
        className,
      )}
    />
  );
}
