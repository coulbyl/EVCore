import type { Metadata } from "next";
import { Search, X } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import {
  activePause,
  PausedScreen,
} from "@/components/scoreboard/states/paused-screen";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { MATCHES_DAYS, type MatchItem } from "@/domains/matches/types/matches";
import { getMatchesDay } from "@/domains/matches/use-cases/get-matches-day";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf } from "@/helpers/scoreboard-format";
import {
  MatchRow,
  MatchWithoutReadingRow,
  SettledMatchRow,
} from "./components/match-row";
import {
  dayHref,
  dayOf,
  hasReading,
  hourGroups,
  queryOf,
} from "./components/matches-constants";
import { SearchBox } from "./components/search-box";
import { WithoutReadingFold } from "./components/without-reading-fold";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: `${t("tabs.matches")} — EVCore` };
}

const LIST_ID = "match-list";

/**
 * « Matchs » (06 § 1, maquettes Matchs et MatchsHier) : trois puces de jour
 * et la loupe dans le bandeau, puis la journée entière rendue côté serveur
 * (GET /matches, page après page) :
 * - Aujourd'hui : les matchs par heure de coup d'envoi, une lecture par
 *   ligne ;
 * - Hier : le score à la place des logos, la lecture et son ✓ ou ✗ ;
 * - Demain : comme Aujourd'hui, et « Lecture ce soir » en gris tant que la
 *   passe du soir n'a pas lu le match.
 * Les matchs sans lecture se replient en bas du jour. La pause ferme
 * l'onglet comme Aujourd'hui (06 § 4).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[]; q?: string | string[] }>;
}) {
  const [shell, t, pauseEnd, params] = await Promise.all([
    getTranslations("shell"),
    getTranslations("matches"),
    activePause(),
    searchParams,
  ]);
  if (pauseEnd) {
    return <PausedScreen until={pauseEnd} title={shell("tabs.matches")} />;
  }

  const day = dayOf(params.day);
  const query = queryOf(params.q);
  const [{ items }, locale, timeZone] = await Promise.all([
    getMatchesDay(day, query),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  // Tomorrow's matches the evening pass has not read yet keep their hour.
  const listed = items.filter(
    (item) => hasReading(item) || item.withoutReading === "tonight",
  );
  const folded = items.filter((item) => !listed.includes(item));
  const noResult = t.raw(`search.noResult.${day}`) as string;

  const settledLabels = (item: MatchItem) => ({
    won: t("result.won"),
    lost: t("result.lost"),
    refunded: t("refunded"),
    postponedShort: t("postponedShort"),
    postponedMeta: t("postponed", { competition: item.competition.name }),
  });

  return (
    <>
      <PlayerBand>
        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup
            label={t("days.label")}
            tone="band"
            className="flex-1"
            items={MATCHES_DAYS.map((key) => ({
              key,
              label: t(`days.${key}`),
              href: dayHref(key),
              active: key === day,
            }))}
          />
          <SearchBox
            key={day}
            listId={LIST_ID}
            day={day}
            initialQuery={query}
            icons={{
              search: <Search aria-hidden strokeWidth={2} className="size-5" />,
              close: <X aria-hidden strokeWidth={2} className="size-5" />,
            }}
            labels={{
              open: t("search.open"),
              close: t("search.close"),
              placeholder: t("search.placeholder"),
              noResult,
            }}
          />
        </div>
      </PlayerBand>
      <h1 className="sr-only">{shell("tabs.matches")}</h1>

      <div id={LIST_ID} className="flex flex-col px-4 pb-4 lg:px-6">
        <p
          data-search-empty
          aria-live="polite"
          hidden={!(query && items.length === 0)}
          className="py-6 text-body text-muted-foreground"
        >
          {noResult.replace("{query}", query)}
        </p>
        {items.length === 0 && !query ? (
          <p className="py-6 text-body text-muted-foreground">
            {t(`empty.${day}`)}
          </p>
        ) : null}
        {day === "yesterday" ? (
          <ul data-group className="divide-y divide-border pt-2">
            {listed.filter(hasReading).map((item) => (
              <SettledMatchRow
                key={item.fixtureId}
                item={item}
                labels={settledLabels(item)}
              />
            ))}
          </ul>
        ) : (
          hourGroups(listed, display, timeZone).map((group) => (
            <section
              key={group.time}
              data-group
              aria-label={t("kickoff", { time: group.time })}
            >
              <h2
                aria-hidden
                className="score sticky top-0 z-10 bg-background pt-4 pb-1 text-meta font-semibold text-muted-foreground"
              >
                {group.time}
              </h2>
              <ul className="divide-y divide-border">
                {group.items.map((item: MatchItem) =>
                  // Played already (a night match seen in the afternoon):
                  // its score and its ✓ ✗, as in « Hier », in its hour.
                  hasReading(item) &&
                  (item.state === "finished" || item.state === "postponed") ? (
                    <SettledMatchRow
                      key={item.fixtureId}
                      item={item}
                      labels={settledLabels(item)}
                    />
                  ) : hasReading(item) ? (
                    <MatchRow key={item.fixtureId} item={item} />
                  ) : (
                    <MatchWithoutReadingRow
                      key={item.fixtureId}
                      item={item}
                      reason={t("without.tonight")}
                    />
                  ),
                )}
              </ul>
            </section>
          ))
        )}
        <WithoutReadingFold
          items={folded}
          locale={display}
          timeZone={timeZone}
        />
      </div>
    </>
  );
}
