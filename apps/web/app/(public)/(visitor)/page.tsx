import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { getPublicToday } from "@/domains/public/use-cases/get-public-today";
import type { PublicToday } from "@/domains/public/types/public";
import {
  DEFAULT_TIME_ZONE,
  displayLocaleOf,
  formatShortDate,
} from "@/helpers/scoreboard-format";
import { HeroCard } from "../../(player)/today/components/hero-card";
import { ProductRows } from "../../(player)/today/components/product-rows";
import { VisitorBand } from "./visitor-band";
import { VisitorFooter } from "./visitor-footer";

/**
 * La landing (11 § 1, maquettes Landing, LandingMobile) : un écran, pas une
 * page qui défile. La phrase de marque, le héros du jour en vrai (la carte
 * d'Aujourd'hui sans « Suivre », perdu ou vide compris), le bouton, les
 * quatre premières lignes de Résultats datées, trois lignes sur le
 * fonctionnement, le pied légal. Rendu côté serveur, sans JS client : un
 * titre, deux paragraphes, trois chiffres sur la carte.
 *
 * Aucun taux ni ROI en argument : des comptes datés (« 11 jours gagnés sur
 * 14 »), qui se vérifient sur /resultats.
 */
export default async function LandingPage() {
  const [t, today] = await Promise.all([
    getTranslations("landing"),
    getPublicToday(),
  ]);

  return (
    <>
      <VisitorBand />
      <main id="contenu" className="flex flex-col gap-6 px-4 pt-6 pb-8 lg:px-6">
        <h1 className="score text-title font-bold text-balance">
          {t("brandLine")}
        </h1>
        {today ? <TodaySection today={today} /> : null}
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/auth/register"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-bet font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
          >
            {t("signUp")}
          </Link>
          <p className="text-meta text-muted-foreground">{t("free")}</p>
        </div>
        {today ? <ResultsSection today={today} /> : null}
        <section aria-labelledby="how-title" className="flex flex-col gap-2">
          <h2 id="how-title" className="text-body font-semibold">
            {t("howTitle")}
          </h2>
          <p className="text-body text-muted-foreground">{t("how")}</p>
        </section>
      </main>
      <VisitorFooter />
    </>
  );
}

/**
 * Le héros, ou le jour vide tel qu'un joueur le voit : la ligne Hier et
 * « Rien à jouer aujourd'hui » avec la raison de chaque produit. Sans
 * même une abstention, la ligne de panne.
 */
async function TodaySection({ today }: { today: PublicToday }) {
  const t = await getTranslations("today");
  const { hero, heroForm } = today;
  if (hero) {
    return (
      <HeroCard
        coupon={{ ...hero, canFollow: false, followedByMe: false }}
        form={
          heroForm
            ? {
                product: hero.product,
                days: heroForm.days,
                won: heroForm.won,
                played: heroForm.played,
                worstLosingStreak: 0,
              }
            : undefined
        }
        couponPath={null}
      />
    );
  }
  return (
    <section
      aria-labelledby="nothing-title"
      className="flex flex-col gap-1 rounded-[0.875rem] border border-border bg-card px-4 pt-4 pb-1 text-card-foreground"
    >
      {today.yesterday.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 text-meta text-muted-foreground">
          <span>{t("yesterday")}</span>
          {today.yesterday.map((item) => (
            <span key={item.product} className="flex items-center gap-1.5">
              {t(`shortNames.${item.product}`)}
              {item.outcome === "pending" ? null : (
                <ResultMark
                  kind={item.outcome}
                  size="sm"
                  label={t(item.outcome === "void" ? "refunded" : item.outcome)}
                />
              )}
            </span>
          ))}
        </p>
      ) : null}
      <h2 id="nothing-title" className="score text-title font-semibold">
        {today.absences.length > 0 ? t("nothingTitle") : t("noCouponYet")}
      </h2>
      {today.absences.length > 0 ? (
        <ProductRows
          coupons={[]}
          absences={today.absences}
          followedInProgress={[]}
          underNothingTitle
        />
      ) : (
        <div className="pb-3" />
      )}
    </section>
  );
}

/**
 * « Nos résultats, depuis le 13/10 » : les trois premiers produits et
 * l'Avis IA, comptés comme sur Résultats (« Trop tôt » sous dix jours),
 * et le lien vers la page publique où tout se vérifie.
 */
async function ResultsSection({ today }: { today: PublicToday }) {
  const [t, r, locale] = await Promise.all([
    getTranslations("landing"),
    getTranslations("results"),
    getLocale(),
  ]);
  const since = [...today.results.map((p) => p.since), today.ai.since]
    .filter((date): date is string => date !== null)
    .sort()[0];
  const rows = [
    ...today.results.map((product) => ({
      key: product.product,
      name: r(`names.${product.product}`),
      tooEarly: product.tooEarly,
      figure: product.tooEarly
        ? r("tooEarlyDays", { count: product.won + product.lost })
        : r("daysWon", {
            won: product.won,
            played: product.won + product.lost,
          }),
    })),
    {
      key: "AI",
      name: r("ai"),
      tooEarly: today.ai.tooEarly,
      figure: today.ai.tooEarly
        ? r("tooEarlyAdvice", { count: today.ai.won + today.ai.lost })
        : r("adviceWon", {
            won: today.ai.won,
            played: today.ai.won + today.ai.lost,
          }),
    },
  ];

  return (
    <section aria-labelledby="results-title" className="flex flex-col">
      <h2 id="results-title" className="pb-1 text-body font-semibold">
        {since
          ? t("resultsSince", {
              date: formatShortDate(
                new Date(`${since}T12:00:00Z`),
                displayLocaleOf(locale),
                DEFAULT_TIME_ZONE,
              ),
            })
          : t("results")}
      </h2>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex min-h-12 items-center justify-between gap-3 text-body"
          >
            <span className="font-medium">{row.name}</span>
            <span
              className={
                row.tooEarly ? "text-muted-foreground" : "score font-semibold"
              }
            >
              {row.figure}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/resultats"
        className="flex min-h-12 items-center justify-between gap-3 border-t border-border text-body font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {t("seeAll")}
        <ChevronRight
          aria-hidden
          className="size-[1.125rem] text-icon-subtle"
          strokeWidth={2}
        />
      </Link>
    </section>
  );
}
