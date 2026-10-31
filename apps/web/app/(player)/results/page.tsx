import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { RESULTS_PERIODS } from "@/domains/results/types/results";
import { getResults } from "@/domains/results/use-cases/get-results";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { ProductRows } from "./components/product-rows";
import {
  earliestSince,
  periodHref,
  periodOf,
} from "./components/results-constants";
import { ResultsYesterdayLine } from "./components/results-yesterday-line";

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
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const [shell, t, params, locale, timeZone] = await Promise.all([
    getTranslations("shell"),
    getTranslations("results"),
    searchParams,
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const period = periodOf(params.period);
  const screen = await getResults(period);
  const since = earliestSince(screen);

  return (
    <>
      <PlayerBand>
        <ResultsYesterdayLine screen={screen} />
      </PlayerBand>
      <h1 className="sr-only">{shell("tabs.results")}</h1>
      <div className="flex flex-col gap-2 px-4 pt-3 pb-4 lg:px-6">
        <ChipGroup
          label={t("periods.label")}
          items={RESULTS_PERIODS.map((key) => ({
            key,
            label: t(`periods.${key}`),
            href: periodHref(key),
            active: key === period,
          }))}
        />
        <ProductRows products={screen.products} ai={screen.ai} />
        {since ? (
          <p className="pt-1 text-meta text-muted-foreground">
            {t("since", {
              date: formatShortDate(
                new Date(`${since}T12:00:00Z`),
                displayLocaleOf(locale),
                timeZone,
              ),
            })}
          </p>
        ) : null}
      </div>
    </>
  );
}
