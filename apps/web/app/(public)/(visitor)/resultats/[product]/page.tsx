import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getPublicAiDetail,
  getPublicProductDetail,
} from "@/domains/public/use-cases/get-public-results";
import { displayLocaleOf } from "@/helpers/scoreboard-format";
import {
  AiBody,
  ProductBody,
} from "../../../../(player)/results/components/results-sheet";
import {
  periodHref,
  periodOf,
  sheetOf,
} from "../../../../(player)/results/components/results-constants";
import { VisitorBand } from "../../visitor-band";
import { VisitorFooter } from "../../visitor-footer";

type Props = {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
};

/** A product or the AI only: Hier and Ta semaine are a player's. */
function lineOf(slug: string) {
  const sheet = sheetOf(slug);
  return sheet?.kind === "product" || sheet?.kind === "ai" ? sheet : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ product }, t] = await Promise.all([
    params,
    getTranslations("results.sheet"),
  ]);
  const line = lineOf(product);
  if (!line) return {};
  const title = t(`titles.${line.kind === "ai" ? "AI" : line.product}`);
  return {
    title: `${title} — EVCore`,
    alternates: { canonical: `/resultats/${product}` },
  };
}

/**
 * Une ligne de /resultats ouverte (11 § 1) : le détail de la feuille de
 * Résultats en page, sans compte — la grille, annoncé contre réalisé, les
 * francs, jour par jour. Ni coupon à ouvrir ni aide, réservés aux comptes.
 */
export default async function PublicResultPage({
  params,
  searchParams,
}: Props) {
  const [{ product }, query, t, shell, locale] = await Promise.all([
    params,
    searchParams,
    getTranslations("results.sheet"),
    getTranslations("shell"),
    getLocale(),
  ]);
  const line = lineOf(product);
  if (!line) notFound();
  const period = periodOf(query.period);
  const display = displayLocaleOf(locale);

  const body =
    line.kind === "ai" ? (
      <AiBody
        detail={await getPublicAiDetail(period)}
        period={period}
        t={t}
        locale={display}
        visitor
      />
    ) : (
      <ProductBody
        detail={await getPublicProductDetail(line.product, period)}
        period={period}
        t={t}
        locale={display}
        visitor
      />
    );

  return (
    <>
      <VisitorBand />
      <main id="contenu" className="flex flex-col gap-3 px-4 pt-4 pb-8 lg:px-6">
        <Link
          href={periodHref(period, "/resultats")}
          className="inline-flex min-h-11 items-center gap-1 self-start text-body text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2} />
          {shell("tabs.results")}
        </Link>
        <h1 className="score text-title font-bold">
          {t(`titles.${line.kind === "ai" ? "AI" : line.product}`)}
        </h1>
        {body}
      </main>
      <VisitorFooter />
    </>
  );
}
