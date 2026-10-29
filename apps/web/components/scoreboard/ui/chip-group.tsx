import Link from "next/link";
import { cn } from "@evcore/ui/cn";

/**
 * Les puces : le jour de Matchs (Hier · Aujourd'hui · Demain), la période de
 * Résultats (30 j · 90 j · Tout), En cours · Réglés dans Moi. Au plus une
 * rangée de puces par écran (02 § 5).
 *
 * Ce sont des liens : le choix vit dans l'adresse, l'écran se rend côté
 * serveur avec la bonne donnée, et le retour du téléphone revient au choix
 * précédent. La puce choisie s'allume en ambre (texte encre, 10,3:1).
 */
export type ChipItem = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

export function ChipGroup({
  items,
  label,
  tone = "surface",
  className,
}: {
  items: readonly ChipItem[];
  /** Ce que les puces choisissent (« Jour »), pour les lecteurs d'écran. */
  label: string;
  /** `band` : posées sur l'encre du bandeau. */
  tone?: "surface" | "band";
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-full px-4 text-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                item.active
                  ? "bg-led-on font-semibold text-band"
                  : tone === "band"
                    ? "text-band-muted hover:text-band-foreground"
                    : "text-muted-foreground hover:text-foreground",
                tone === "band"
                  ? "focus-visible:outline-led-on"
                  : "focus-visible:outline-ring",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
