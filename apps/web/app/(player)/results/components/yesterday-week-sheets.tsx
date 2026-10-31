import { getLocale, getTranslations } from "next-intl/server";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import {
  getWeek,
  getYesterday,
} from "@/domains/results/use-cases/get-result-details";
import type {
  ResultsPeriod,
  ResultsProductKey,
  WeekScreen,
} from "@/domains/results/types/results";
import {
  displayLocaleOf,
  formatOdds,
  formatShortDate,
  formatShortWeekdayDay,
  formatWeekdayDay,
} from "@/helpers/scoreboard-format";
import { HeroCard } from "../../today/components/hero-card";
import { ProductRows } from "../../today/components/product-rows";
import { periodHref } from "./results-constants";

const DAY_MS = 86_400_000;

/**
 * The « Hier » line opened (08 § 3): yesterday's coupons, all, settled, the
 * same cards as Aujourd'hui in the same order (✓ or ✗ in large, the odds
 * paid), each opening its settled coupon; the products absent yesterday in
 * grey with their reason.
 */
export async function YesterdaySheet({ period }: { period: ResultsPeriod }) {
  const [t, locale, screen] = await Promise.all([
    getTranslations("results.sheet"),
    getLocale(),
    getYesterday(),
  ]);
  const display = displayLocaleOf(locale);
  const hero = screen.coupons.find((c) => c.id === screen.heroId);
  const others = screen.coupons.filter((c) => c !== hero);
  return (
    <Sheet
      title={t("yesterdayTitle", {
        date: formatWeekdayDay(
          new Date(`${screen.date}T12:00:00Z`),
          display,
          "UTC",
        ),
      })}
      fallbackHref={periodHref(period)}
    >
      {screen.coupons.length === 0 && screen.absences.length === 0 ? (
        <p className="text-body text-muted-foreground">
          {t("nothingYesterday")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {hero ? (
            <HeroCard
              coupon={hero}
              form={undefined}
              couponPath="/results/coupon"
            />
          ) : null}
          <ProductRows
            coupons={others}
            absences={screen.absences}
            followedInProgress={[]}
            underNothingTitle
            couponPath="/results/coupon"
          />
        </div>
      )}
    </Sheet>
  );
}

/**
 * « Ta semaine » (08 § 3, maquette Semaine): the seven days of the week
 * closed last Sunday in rows, the mark of each product and its odds paid,
 * the totals, the coupons the player followed. The Monday statement, the
 * same count as the 8 o'clock notification.
 */
export async function WeekSheet({ period }: { period: ResultsPeriod }) {
  const [t, results, today, locale, week] = await Promise.all([
    getTranslations("results.sheet"),
    getTranslations("results"),
    getTranslations("today"),
    getLocale(),
    getWeek(),
  ]);
  const display = displayLocaleOf(locale);
  const monday = new Date(`${week.week}T12:00:00Z`);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const columns = columnsOf(week);
  const hero = week.products[0];
  const followed = week.followed;

  return (
    <Sheet title={t("weekTitle")} fallbackHref={periodHref(period)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-meta text-muted-foreground">
            {t("weekRange", {
              from: String(monday.getUTCDate()),
              to: formatShortDate(sunday, display, "UTC"),
            })}
          </p>
          {hero ? (
            <p className="text-body">
              <span className="font-medium">
                {results(`names.${hero.product}`)}
              </span>{" "}
              <span className="score font-semibold">
                {results("weekSummary", {
                  won: hero.won,
                  played: hero.played,
                })}
              </span>
            </p>
          ) : null}
        </div>

        {columns.length > 0 ? (
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="text-meta text-muted-foreground">
                <th scope="col" className="py-2 text-start font-normal">
                  <span className="sr-only">{t("dayColumn")}</span>
                </th>
                {columns.map((product) => (
                  <th
                    key={product}
                    scope="col"
                    className="score py-2 text-center font-semibold"
                  >
                    <abbr
                      title={today(`shortNames.${product}`)}
                      className="no-underline"
                    >
                      {today(`codes.${product}`)}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-y border-border">
              {week.days.map((day) => (
                <tr key={day.date}>
                  <th
                    scope="row"
                    className="score py-2.5 text-start text-meta font-medium"
                  >
                    {formatShortWeekdayDay(
                      new Date(`${day.date}T12:00:00Z`),
                      display,
                      "UTC",
                    )}
                  </th>
                  {columns.map((product) => {
                    const mark = day.marks.find((m) => m.product === product);
                    return (
                      <td key={product} className="py-2.5 text-center">
                        <WeekMark
                          mark={mark}
                          labels={{
                            won: t("won"),
                            lost: t("lost"),
                            refunded: t("refunded"),
                          }}
                          odds={
                            mark?.paidOdds != null
                              ? formatOdds(mark.paidOdds, display)
                              : null
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="py-2.5 text-start text-meta font-medium"
                >
                  {t("total")}
                </th>
                {columns.map((product) => {
                  const count = week.products.find(
                    (p) => p.product === product,
                  );
                  return (
                    <td
                      key={product}
                      className="score py-2.5 text-center text-meta font-semibold"
                    >
                      {count
                        ? t("outOf", { won: count.won, played: count.played })
                        : "–"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        ) : null}

        {followed.won + followed.lost + followed.refunded > 0 ? (
          <p className="flex flex-col gap-0.5 text-body">
            <span className="text-meta text-muted-foreground">
              {t("followedWeek")}
            </span>
            <span className="score font-semibold">
              {t("followedCounts", { won: followed.won, lost: followed.lost })}
              {followed.refunded > 0
                ? ` · ${t("followedRefunded", { count: followed.refunded })}`
                : null}
            </span>
          </p>
        ) : null}

        <p className="text-meta text-muted-foreground">{t("mondayNote")}</p>
      </div>
    </Sheet>
  );
}

/** The products that played or had a coupon that week, in screen order. */
function columnsOf(week: WeekScreen): ResultsProductKey[] {
  const seen: ResultsProductKey[] = [];
  for (const day of week.days) {
    for (const mark of day.marks) {
      if (!seen.includes(mark.product)) seen.push(mark.product);
    }
  }
  const order = week.days.flatMap((d) => d.marks.map((m) => m.product));
  // The server sorts each day's marks in screen order; keep that order.
  return seen.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function WeekMark({
  mark,
  labels,
  odds,
}: {
  mark: WeekScreen["days"][number]["marks"][number] | undefined;
  labels: { won: string; lost: string; refunded: string };
  odds: string | null;
}) {
  if (!mark || mark.outcome === "pending") {
    return (
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
    );
  }
  const kind =
    mark.outcome === "refunded" ? "void" : (mark.outcome as "won" | "lost");
  return (
    <span className="inline-flex items-baseline gap-1">
      <ResultMark
        kind={kind}
        size="sm"
        label={labels[mark.outcome as "won" | "lost" | "refunded"]}
        className="self-center"
      />
      {odds ? (
        <span className="score text-meta font-semibold">{odds}</span>
      ) : null}
    </span>
  );
}
