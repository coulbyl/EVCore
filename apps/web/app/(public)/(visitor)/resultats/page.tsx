import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { RESULTS_PERIODS } from "@/domains/results/types/results";
import { getPublicResults } from "@/domains/public/use-cases/get-public-results";
import {
  DEFAULT_TIME_ZONE,
  displayLocaleOf,
  formatShortDate,
} from "@/helpers/scoreboard-format";
import { ProductRows } from "../../../(player)/results/components/product-rows";
import {
  earliestSince,
  periodHref,
  periodOf,
} from "../../../(player)/results/components/results-constants";
import { BandTitle } from "../band-title";
import { VisitorBand } from "../visitor-band";
import { VisitorFooter } from "../visitor-footer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return {
    title: `${t("tabs.results")} — EVCore`,
    alternates: { canonical: "/resultats" },
  };
}

/**
 * /resultats (11 § 1) : l'onglet Résultats en lecture seule, sans compte.
 * Mêmes lignes, mêmes périodes, même détail par produit : tout ce que la
 * landing affirme s'y vérifie. Remplace la page Mesures historiques
 * publique. Sans la ligne Hier du joueur : ses feuilles ouvrent des coupons
 * réservés aux comptes.
 */
export default async function PublicResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const [shell, landing, t, params, locale] = await Promise.all([
    getTranslations("shell"),
    getTranslations("landing"),
    getTranslations("results"),
    searchParams,
    getLocale(),
  ]);
  const period = periodOf(params.period);
  const screen = await getPublicResults(period);
  const since = earliestSince(screen);

  return (
    <>
      <VisitorBand>
        <BandTitle
          title={shell("tabs.results")}
          back={{ href: "/", label: landing("home") }}
        />
      </VisitorBand>
      <main
        id="contenu"
        className="mx-auto w-full max-w-[40rem] flex flex-col gap-2 px-4 pt-3 pb-8 lg:px-6"
      >
        <ChipGroup
          label={t("periods.label")}
          items={RESULTS_PERIODS.map((key) => ({
            key,
            label: t(`periods.${key}`),
            href: periodHref(key, "/resultats"),
            active: key === period,
          }))}
        />
        <ProductRows
          products={screen.products}
          ai={screen.ai}
          period={period}
          base="/resultats"
        />
        {since ? (
          <p className="pt-1 text-meta text-muted-foreground">
            {t("since", {
              date: formatShortDate(
                new Date(`${since}T12:00:00Z`),
                displayLocaleOf(locale),
                DEFAULT_TIME_ZONE,
              ),
            })}
          </p>
        ) : null}
      </main>
      <VisitorFooter />
    </>
  );
}
