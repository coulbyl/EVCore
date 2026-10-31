import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { RESULTS_PERIODS } from "@/domains/results/types/results";
import { getResults } from "@/domains/results/use-cases/get-results";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { ProductRows } from "./components/product-rows";
import { PeriodDates } from "./components/period-dates";
import {
  earliestSince,
  periodHref,
  periodOf,
  rangeDays,
} from "./components/results-constants";
import { ResultsYesterdayLine } from "./components/results-yesterday-line";

/** Today in the player's time zone, YYYY-MM-DD: the last day one can pick. */
function todayOf(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: `${t("tabs.results")} — EVCore` };
}

/**
 * « Résultats » (08 § 1, maquette Resultats) : la ligne Hier dans le
 * bandeau, les puces de période (90 jours par défaut), une ligne par
 * produit et la ligne de l'IA, la date d'où l'on compte. Rendu côté
 * serveur en une lecture (GET /results/products). Ouvert pendant une pause
 * (08 § 4) : le passé n'est pas une suggestion.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
}) {
  const [shell, t, params, locale, timeZone] = await Promise.all([
    getTranslations("shell"),
    getTranslations("results"),
    searchParams,
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const period = periodOf(params.period, params);
  const screen = await getResults(period);
  const since = earliestSince(screen);
  const display = displayLocaleOf(locale);
  // Days are UTC days: read at noon, they fall on the same date anywhere.
  const short = (day: string) =>
    formatShortDate(new Date(`${day}T12:00:00Z`), display, "UTC");
  const range = rangeDays(period);

  return (
    <>
      {/* Two lines as on Aujourd'hui, the choices in the band as on Matchs. */}
      <PlayerBand>
        <div className="flex flex-col gap-2">
          <ResultsYesterdayLine screen={screen} period={period} />
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipGroup
              label={t("periods.label")}
              tone="band"
              items={RESULTS_PERIODS.map((key) => ({
                key,
                label: t(`periods.${key}`),
                href: periodHref(key),
                active: key === period,
              }))}
            />
            <PeriodDates
              action="/results"
              active={range !== null}
              label={
                range
                  ? t("periods.range", {
                      from: short(range.from),
                      to: short(range.to),
                    })
                  : t("periods.dates")
              }
              from={range?.from ?? since ?? screen.until}
              to={range?.to ?? screen.until}
              max={todayOf(timeZone)}
              texts={{
                title: t("periods.datesTitle"),
                from: t("periods.from"),
                to: t("periods.to"),
                show: t("periods.show"),
                close: t("periods.close"),
              }}
            />
          </div>
        </div>
      </PlayerBand>
      <h1 className="sr-only">{shell("tabs.results")}</h1>
      <div className="flex flex-col gap-2 px-4 pt-1 pb-4 lg:px-6">
        <ProductRows
          products={screen.products}
          ai={screen.ai}
          period={period}
        />
        {range ? (
          <p className="pt-1 text-meta text-muted-foreground">
            {t("between", { from: short(range.from), to: short(screen.until) })}
          </p>
        ) : since ? (
          <p className="pt-1 text-meta text-muted-foreground">
            {t("since", { date: short(since) })}
          </p>
        ) : null}
      </div>
    </>
  );
}
