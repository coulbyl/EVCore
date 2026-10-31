import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ScoreLine,
  type ScoreItem,
} from "@/components/scoreboard/ui/score-line";
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
 * line as on Aujourd'hui with the day, and the odds really paid after a ✓,
 * « FAV ✓ 1,24 · COM ✓ 1,41 · C2 ✗ »; it opens yesterday's coupons
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
  const items: ScoreItem[] = screen.yesterday.items.map((item) => ({
    code: today(`codes.${item.product}`),
    label: today(`shortNames.${item.product}`),
    outcome:
      item.outcome === "refunded"
        ? "void"
        : item.outcome === "pending"
          ? "pending"
          : item.outcome,
    odds:
      item.outcome === "won" && item.paidOdds !== null
        ? formatOdds(item.paidOdds, display)
        : undefined,
  }));
  return (
    <Link
      href={sheetHref(YESTERDAY_SLUG, period)}
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md focus-visible:outline-2 focus-visible:outline-led-on"
    >
      <span className="text-meta text-band-muted">
        {t("yesterday")}{" "}
        <span className="ms-0.5 font-semibold text-band-foreground">
          {formatWeekdayDay(
            new Date(`${screen.yesterday.date}T12:00:00Z`),
            display,
            "UTC",
          )}
        </span>
      </span>
      {/* Without a list name: the link reads « Hier vendredi 30 Favori :
          gagné, cote 1,24… ». */}
      <ScoreLine items={items} />
    </Link>
  );
}
