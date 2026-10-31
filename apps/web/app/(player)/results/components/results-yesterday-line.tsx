import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { YesterdaySummary } from "@/components/scoreboard/ui/yesterday-summary";
import {
  displayLocaleOf,
  formatOdds,
  formatWeekdayDay,
} from "@/helpers/scoreboard-format";
import type {
  ResultsPeriod,
  ResultsScreen,
} from "@/domains/results/types/results";
import { sheetHref, WEEK_SLUG, YESTERDAY_SLUG } from "./results-constants";

/**
 * « Hier » at the top of Résultats (08 § 1, maquette Resultats): the same
 * line as on Aujourd'hui with the day: the first product in words with its
 * ✓ ✗ and the odds paid, then « 4 gagnés sur 7 »; it opens yesterday's coupons
 * (08 § 3). Monday: « Ta semaine · Favori 5 jours gagnés sur 6 », the hero's
 * count, opening the week. Nothing played: nothing.
 */
export async function ResultsYesterdayLine({
  screen,
  period,
}: {
  screen: ResultsScreen;
  period: ResultsPeriod;
}) {
  const [t, today, locale] = await Promise.all([
    getTranslations("results"),
    getTranslations("today"),
    getLocale(),
  ]);
  const display = displayLocaleOf(locale);

  if (screen.week) {
    // The hero's count: the first product of the screen that played.
    const hero = screen.week.products.find((p) => p.played > 0);
    if (!hero) return null;
    return (
      <Link
        href={sheetHref(WEEK_SLUG, period)}
        className="flex flex-wrap items-baseline gap-x-3 rounded-md focus-visible:outline-2 focus-visible:outline-led-on"
      >
        <span className="text-meta text-band-muted">{t("week")}</span>
        <span className="text-body">{t(`names.${hero.product}`)}</span>
        <span className="score text-bet font-semibold">
          {t("weekSummary", { won: hero.won, played: hero.played })}
        </span>
      </Link>
    );
  }

  if (screen.yesterday.items.length === 0) return null;
  const [first] = screen.yesterday.items;
  if (!first) return null;
  const played = screen.yesterday.items.filter(
    (item) => item.outcome === "won" || item.outcome === "lost",
  );
  const won = played.filter((item) => item.outcome === "won").length;
  return (
    <YesterdaySummary
      href={sheetHref(YESTERDAY_SLUG, period)}
      label={
        <>
          {t("yesterday")}{" "}
          <span className="ms-0.5 font-semibold text-band-foreground">
            {formatWeekdayDay(
              new Date(`${screen.yesterday.date}T12:00:00Z`),
              display,
              "UTC",
            )}
          </span>
        </>
      }
      lead={{
        name: today(`shortNames.${first.product}`),
        outcome:
          first.outcome === "refunded"
            ? "void"
            : first.outcome === "pending"
              ? "pending"
              : first.outcome,
        odds:
          first.outcome === "won" && first.paidOdds !== null
            ? formatOdds(first.paidOdds, display)
            : undefined,
      }}
      count={
        screen.yesterday.items.length > 1
          ? today("yesterdayCount", { won, played: played.length })
          : null
      }
      outcomeLabels={{
        won: today("won"),
        lost: today("lost"),
        void: today("refunded"),
      }}
    />
  );
}
