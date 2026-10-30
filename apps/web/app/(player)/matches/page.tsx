import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import {
  activePause,
  PausedScreen,
} from "@/components/scoreboard/states/paused-screen";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { MATCHES_DAYS } from "@/domains/matches/types/matches";
import { getMatchesDay } from "@/domains/matches/use-cases/get-matches-day";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf } from "@/helpers/scoreboard-format";
import { MatchRow } from "./components/match-row";
import {
  dayHref,
  dayOf,
  hasReading,
  hourGroups,
} from "./components/matches-constants";
import { WithoutReadingFold } from "./components/without-reading-fold";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: `${t("tabs.matches")} — EVCore` };
}

/**
 * « Matchs » (06 § 1, maquette Matchs) : trois puces de jour dans le
 * bandeau, les matchs regroupés par heure de coup d'envoi, une lecture par
 * ligne, les matchs sans lecture repliés en bas du jour. Rendu côté serveur
 * sur toute la journée (GET /matches, page après page). La pause ferme
 * l'onglet comme Aujourd'hui (06 § 4).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[] }>;
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
  const [{ items }, locale, timeZone] = await Promise.all([
    getMatchesDay(day),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const groups = hourGroups(items.filter(hasReading), display, timeZone);
  const without = items.filter((item) => !hasReading(item));

  return (
    <>
      <PlayerBand>
        <ChipGroup
          label={t("days.label")}
          tone="band"
          items={MATCHES_DAYS.map((key) => ({
            key,
            label: t(`days.${key}`),
            href: dayHref(key),
            active: key === day,
          }))}
        />
      </PlayerBand>
      <h1 className="sr-only">{shell("tabs.matches")}</h1>
      <div className="flex flex-col px-4 pb-4 lg:px-6">
        {items.length === 0 ? (
          <p className="py-6 text-body text-muted-foreground">
            {t(`empty.${day}`)}
          </p>
        ) : null}
        {groups.map((group) => (
          <section
            key={group.time}
            aria-label={t("kickoff", { time: group.time })}
          >
            <h2
              aria-hidden
              className="score sticky top-0 z-10 bg-background pt-4 pb-1 text-meta font-semibold text-muted-foreground"
            >
              {group.time}
            </h2>
            <ul className="divide-y divide-border">
              {group.items.map((item) => (
                <MatchRow key={item.fixtureId} item={item} />
              ))}
            </ul>
          </section>
        ))}
        <WithoutReadingFold
          items={without}
          locale={display}
          timeZone={timeZone}
        />
      </div>
    </>
  );
}
