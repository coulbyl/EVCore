import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
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
      <VisitorBand>
        <h1 className="score text-title font-bold text-balance">
          {t("brandLine")}
        </h1>
      </VisitorBand>
      <main
        id="contenu"
        className="mx-auto w-full max-w-[40rem] flex flex-col gap-6 px-4 pt-4 pb-8 lg:px-6"
      >
        {today ? <TodaySection today={today} /> : null}
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/auth/register"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[0.625rem] bg-primary px-6 text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
          >
            {t("signUp")}
          </Link>
          <p className="text-meta text-muted-foreground">{t("free")}</p>
        </div>
        {today ? <ResultsSection today={today} /> : null}
        <section aria-labelledby="how-title" className="flex flex-col gap-2">
          <h2 id="how-title" className="text-body font-medium">
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
 * Le héros du jour. Un jour sans héros, jamais une carte vide ni une ligne
 * de panne pour un visiteur : « Rien à jouer aujourd'hui » et la raison de
 * chaque produit quand le moteur s'est abstenu, puis le dernier coupon
 * publié de la semaine avec son jour et son issue — le produit en vrai,
 * pertes comprises.
 */
async function TodaySection({ today }: { today: PublicToday }) {
  const [t, landing, locale] = await Promise.all([
    getTranslations("today"),
    getTranslations("landing"),
    getLocale(),
  ]);
  const { hero, lastHero, heroForm } = today;
  const shown = hero ?? lastHero?.coupon;
  const card = shown ? (
    <HeroCard
      coupon={{ ...shown, canFollow: false, followedByMe: false }}
      form={
        heroForm
          ? {
              product: shown.product,
              days: heroForm.days,
              won: heroForm.won,
              played: heroForm.played,
              worstLosingStreak: 0,
            }
          : undefined
      }
      couponPath={null}
    />
  ) : null;
  if (hero) return card;

  return (
    <div className="flex flex-col gap-4">
      {today.absences.length > 0 ? (
        <section aria-labelledby="nothing-title" className="flex flex-col">
          <h2 id="nothing-title" className="text-body font-medium">
            {t("nothingTitle")}
          </h2>
          <ProductRows
            coupons={[]}
            absences={today.absences}
            followedInProgress={[]}
            underNothingTitle
          />
        </section>
      ) : null}
      {lastHero && card ? (
        <div className="flex flex-col gap-2">
          <p className="text-meta text-muted-foreground">
            {landing("lastHero", {
              date: formatShortDate(
                new Date(`${lastHero.date}T12:00:00Z`),
                displayLocaleOf(locale),
                DEFAULT_TIME_ZONE,
              ),
            })}
          </p>
          {card}
        </div>
      ) : null}
    </div>
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
  // Only the lines that have played: an empty line tells a visitor
  // nothing here, /resultats keeps every product (« Pas encore joué »).
  const rows = [
    ...today.results
      .filter((product) => product.won + product.lost > 0)
      .map((product) => ({
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
    ...(today.ai.won + today.ai.lost > 0
      ? [
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
        ]
      : []),
  ];

  return (
    <section aria-labelledby="results-title" className="flex flex-col">
      <h2 id="results-title" className="pb-1 text-body font-medium">
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
