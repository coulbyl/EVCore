import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { MatchItem, MatchReading } from "@/domains/matches/types/matches";
import { SettledMatchRow } from "./match-row";

/**
 * The matches of today already played, folded at the top of the day:
 * « 14 matchs déjà joués · Voir ». The list starts at the next kick-off;
 * unfolded, each shows its score and its ✓ ✗, as in « Hier ». A
 * `<details>`: it opens without any JavaScript.
 */
export async function PlayedFold({
  items,
}: {
  items: readonly (MatchItem & { reading: MatchReading })[];
}) {
  const t = await getTranslations("matches");
  if (items.length === 0) return null;
  return (
    <details className="group border-b border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 text-body text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{t("played", { count: items.length })}</span>
        <span className="font-medium text-foreground group-open:hidden">
          {t("see")}
        </span>
        <ChevronDown
          aria-hidden
          strokeWidth={2}
          className="size-[1.125rem] shrink-0 text-icon-subtle transition-transform group-open:rotate-180"
        />
      </summary>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <SettledMatchRow
            key={item.fixtureId}
            item={item}
            labels={{
              won: t("result.won"),
              lost: t("result.lost"),
              refunded: t("refunded"),
              postponedShort: t("postponedShort"),
              postponedMeta: t("postponed", {
                competition: item.competition.name,
              }),
            }}
          />
        ))}
      </ul>
    </details>
  );
}
