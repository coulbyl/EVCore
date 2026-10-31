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
import type { ResultsScreen } from "@/domains/results/types/results";

/**
 * « Hier » at the top of Résultats (08 § 1, maquette Resultats): the same
 * line as on Aujourd'hui with the day, and the odds really paid after a ✓,
 * « FAV ✓ 1,24 · COM ✓ 1,41 · C2 ✗ ». Monday: « Ta semaine : 5 jours
 * gagnés sur 6 ». Nothing played: nothing. The sheet of yesterday's
 * coupons it opens comes with C11.
 */
export async function ResultsYesterdayLine({
  screen,
}: {
  screen: ResultsScreen;
}) {
  const [t, today, locale] = await Promise.all([
    getTranslations("results"),
    getTranslations("today"),
    getLocale(),
  ]);
  const display = displayLocaleOf(locale);

  if (screen.week) {
    const won = screen.week.products.reduce((sum, p) => sum + p.won, 0);
    const played = screen.week.products.reduce((sum, p) => sum + p.played, 0);
    if (played === 0) return null;
    return (
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-meta text-band-muted">{t("week")}</span>
        <span className="score text-bet font-semibold">
          {t("weekSummary", { won, played })}
        </span>
      </p>
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
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-meta text-band-muted">
        {t("yesterday")}
        <span className="ms-1.5 font-semibold text-band-foreground">
          {formatWeekdayDay(
            new Date(`${screen.yesterday.date}T12:00:00Z`),
            display,
            "UTC",
          )}
        </span>
      </span>
      <ScoreLine items={items} label={t("yesterday")} />
    </div>
  );
}
