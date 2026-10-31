import { ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatTime, type DisplayLocale } from "@/helpers/scoreboard-format";
import type { MatchItem } from "@/domains/matches/types/matches";
import { MatchWithoutReadingRow } from "./match-row";

/**
 * The matches without a reading, folded at the bottom of the day (06 § 1,
 * § 6): « 14 matchs sans lecture · Voir ». Unfolded, each says why in grey:
 * « Écarté », « Pas coté chez 1xBet », « Pas de lecture ». A `<details>`:
 * it opens without any JavaScript.
 */
export async function WithoutReadingFold({
  items,
  locale,
  timeZone,
}: {
  items: readonly MatchItem[];
  locale: DisplayLocale;
  timeZone: string;
}) {
  const t = await getTranslations("matches");
  if (items.length === 0) return null;
  return (
    <details className="group border-t border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 text-body text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          {t("withoutReading", { count: items.length })}
        </span>
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
          <MatchWithoutReadingRow
            key={item.fixtureId}
            item={item}
            meta={`${formatTime(new Date(item.kickoffAt), locale, timeZone)} · ${item.competition.name}`}
            reason={t(`without.${item.withoutReading ?? "not_analysed"}`)}
          />
        ))}
      </ul>
    </details>
  );
}
