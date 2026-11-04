import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";
import { chanceOf, type Chance } from "@/helpers/scoreboard-format";
import { spokenOf, type Translate } from "./chance-figure";

/**
 * Une chance qui tient à côté d'une cote, dans une liste (« Autres paris »
 * de la fiche, 04/11) : « 8/10 », « 1/3 », « moins de 1/200 », sans
 * diodes, en petit et en gris ; lue « 1 chance sur 6 ». Une probabilité
 * illisible n'affiche rien.
 */
export function ChanceShort({
  probability,
  className,
}: {
  probability: number;
  className?: string;
}) {
  const t = useTranslations("scoreboard.chance");
  const chance = chanceOf(probability);
  if (!chance) return null;

  return (
    <span
      className={cn(
        "score text-meta whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden>{written(chance, t)}</span>
      <span className="sr-only">{spokenOf(chance, t)}</span>
    </span>
  );
}

function written(chance: Chance, t: Translate) {
  switch (chance.kind) {
    case "outOfTen":
      return t("compactOutOfTen", { count: chance.count, total: chance.total });
    case "oneIn":
      return t("compactOneIn", { total: chance.total });
    case "rarerThan":
      return t("compactRarerThan", { total: chance.total });
  }
}
