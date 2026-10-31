import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Sheet } from "@/components/scoreboard/sheet/sheet";
import { ChanceFigure } from "@/components/scoreboard/ui/chance-figure";
import { FormStrip } from "@/components/scoreboard/ui/form-strip";
import type { Outcome } from "@/components/scoreboard/ui/outcome";
import { ResultMark } from "@/components/scoreboard/ui/result-mark";
import { HelpHint } from "@/components/scoreboard/ui/help-hint";
import { helpSheet } from "@/domains/help/help-sheets";
import {
  getAiDetail,
  getProductDetail,
} from "@/domains/results/use-cases/get-result-details";
import type {
  AiDetail,
  ProductDetail,
  ResultsComparison,
  ResultsFrancs,
  ResultsPeriod,
} from "@/domains/results/types/results";
import { formatLinePick, formatPickWithTeams } from "@/helpers/fixture";
import {
  displayLocaleOf,
  formatFrancs,
  formatOdds,
  formatShortDate,
  type DisplayLocale,
} from "@/helpers/scoreboard-format";
import { periodHref, sheetOf } from "./results-constants";
import { WeekSheet, YesterdaySheet } from "./yesterday-week-sheets";

export type Translate = Awaited<
  ReturnType<typeof getTranslations<"results.sheet">>
>;

/** The squares of the grid, one per day (08 § 2): R for a refund. */
const GRID: Record<string, Outcome> = {
  won: "won",
  lost: "lost",
  refunded: "void",
  pending: "pending",
  none: "none",
};

/** « Aide : « 8 sur 10 », ça veut dire quoi » for the « ? » of Annoncé. */
async function chancesHintOf(locale: DisplayLocale): Promise<string> {
  const help = await getTranslations("help");
  return help("hint", { title: helpSheet("chances", locale)?.title ?? "" });
}

/** A short date « 28/10 » from a UTC day, YYYY-MM-DD. */
function day(date: string, locale: DisplayLocale): string {
  return formatShortDate(new Date(`${date}T12:00:00Z`), locale, "UTC");
}

/** A bet named with its team, from « PSG – Lens » and its pick. */
function betOf(label: string, market: string | null, pick: string | null) {
  if (!market || !pick) return null;
  const [home = "", away = ""] = label.split(" – ");
  return (
    formatLinePick(pick, market, null) ??
    formatPickWithTeams(pick, market, { home, away })
  );
}

/**
 * A line of Résultats opened (08 § 2, maquette Produit): the product's
 * name and its one-line definition, the grid of the period with the count
 * and the worst run, announced against realised, the francs at a fixed
 * stake, then day by day. For « Avis IA » the same blocks with the opinion
 * for unit. Rendered on the server; open during a pause (08 § 4).
 */
export function ResultsSheet({
  slug,
  period,
}: {
  slug: string;
  period: ResultsPeriod;
}) {
  const sheet = sheetOf(slug);
  if (!sheet) notFound();
  if (sheet.kind === "yesterday") return <YesterdaySheet period={period} />;
  if (sheet.kind === "week") return <WeekSheet period={period} />;
  return <LineSheet sheet={sheet} period={period} />;
}

/** A product's or the AI's sheet (08 § 2). */
async function LineSheet({
  sheet,
  period,
}: {
  sheet: NonNullable<ReturnType<typeof sheetOf>>;
  period: ResultsPeriod;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("results.sheet"),
    getLocale(),
  ]);
  const display = displayLocaleOf(locale);
  if (sheet.kind === "ai") {
    const detail = await getAiDetail(period);
    return (
      <Sheet title={t("titles.AI")} fallbackHref={periodHref(period)}>
        <AiBody detail={detail} period={period} t={t} locale={display} />
      </Sheet>
    );
  }
  if (sheet.kind !== "product") notFound();
  const detail = await getProductDetail(sheet.product, period);
  return (
    <Sheet
      title={t(`titles.${detail.product}`)}
      fallbackHref={periodHref(period)}
    >
      <ProductBody detail={detail} period={period} t={t} locale={display} />
    </Sheet>
  );
}

/**
 * `visitor`: /resultats without an account (11 § 1) — no coupon to open,
 * no help sheet, both behind the session.
 */
export async function ProductBody({
  detail,
  period,
  t,
  locale,
  visitor = false,
}: {
  detail: ProductDetail;
  period: ResultsPeriod;
  t: Translate;
  locale: DisplayLocale;
  visitor?: boolean;
}) {
  const [results, reasons] = await Promise.all([
    getTranslations("results"),
    getTranslations("couponAbstentions.reasons"),
  ]);
  const name = results(`names.${detail.product}`);
  const played = detail.won + detail.lost;
  const count = (outcome: string) =>
    detail.grid.filter((cell) => cell.outcome === outcome).length;
  // The AI combo's coupons are the LLM's: not opened as a published coupon.
  const opens = detail.product !== "COMBO_AI" && !visitor;

  return (
    <div className="flex flex-col divide-y divide-border">
      <p className="pb-3 text-body text-muted-foreground">
        {t(`definitions.${detail.product}`)}
      </p>

      <Block
        title={
          period === "all"
            ? t("allSince", { date: day(detail.since, locale) })
            : t("lastDays", { count: Number(period) })
        }
      >
        <FormStrip
          outcomes={detail.grid.map((cell) => GRID[cell.outcome] ?? "none")}
          columns={15}
          label={t("gridLabel", {
            won: count("won"),
            lost: count("lost"),
            refunded: count("refunded"),
            none: count("none"),
          })}
        />
        <p className="text-body">
          <span className="score font-semibold">
            {results("daysWon", { won: detail.won, played })}
          </span>
          {detail.daysWithoutCoupon > 0 ? (
            <span className="text-muted-foreground">
              {" · "}
              {t("daysWithout", {
                count: detail.daysWithoutCoupon,
                product: name,
              })}
            </span>
          ) : null}
        </p>
        <p className="flex gap-3 text-body">
          <span className="text-muted-foreground">{t("worstStreak")}</span>
          <span className="score font-semibold">
            {t("worstValue", { count: detail.worstLosingStreak })}
          </span>
        </p>
      </Block>

      <Figures
        comparison={detail.comparison}
        francs={detail.francs}
        settled={detail.settledDays}
        unit="day"
        t={t}
        locale={locale}
        chancesHint={visitor ? null : await chancesHintOf(locale)}
      />

      <Block title={t("dayByDay")}>
        {detail.days.length === 0 ? (
          <p className="text-body text-muted-foreground">{t("nothing")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.days.map((d) =>
              d.outcome === "none" ? (
                <li
                  key={d.date}
                  className="flex min-h-12 items-center gap-3 py-2 text-muted-foreground"
                >
                  <span className="score w-11 shrink-0 text-meta">
                    {day(d.date, locale)}
                  </span>
                  <span aria-hidden className="w-5 shrink-0 text-center">
                    ·
                  </span>
                  <span className="text-meta">
                    {t("noCoupon", { product: name })}
                    {" · "}
                    {reasons.has(d.reason ?? "other")
                      ? reasons(d.reason ?? "other")
                      : reasons("other")}
                  </span>
                </li>
              ) : (
                <DayRow
                  key={d.date}
                  date={day(d.date, locale)}
                  outcome={d.outcome}
                  text={[d.label, betOf(d.label, d.market, d.pick)]
                    .filter(Boolean)
                    .join(" · ")}
                  odds={
                    d.paidOdds !== null ? formatOdds(d.paidOdds, locale) : null
                  }
                  href={opens ? `/results/coupon/${d.couponId}` : null}
                  t={t}
                />
              ),
            )}
          </ul>
        )}
      </Block>
    </div>
  );
}

export async function AiBody({
  detail,
  period,
  t,
  locale,
  visitor = false,
}: {
  detail: AiDetail;
  period: ResultsPeriod;
  t: Translate;
  locale: DisplayLocale;
  visitor?: boolean;
}) {
  // Oldest first for the grid, as the products' days.
  const chronological = [...detail.opinions].reverse();
  const shown = chronological.slice(-90);
  let worst = 0;
  let run = 0;
  for (const opinion of chronological) {
    if (opinion.outcome === "lost") worst = Math.max(worst, ++run);
    else if (opinion.outcome === "won") run = 0;
  }
  const played = detail.won + detail.lost;

  return (
    <div className="flex flex-col divide-y divide-border">
      <p className="pb-3 text-body text-muted-foreground">
        {t("definitions.AI")}
      </p>

      <Block
        title={
          period === "all" && detail.since
            ? t("allSince", { date: day(detail.since, locale) })
            : t("lastOpinions", { count: shown.length })
        }
      >
        {shown.length > 0 ? (
          <FormStrip
            outcomes={shown.map((o) => GRID[o.outcome] ?? "none")}
            columns={15}
            label={t("gridLabel", {
              won: shown.filter((o) => o.outcome === "won").length,
              lost: shown.filter((o) => o.outcome === "lost").length,
              refunded: shown.filter((o) => o.outcome === "refunded").length,
              none: 0,
            })}
          />
        ) : null}
        <AdviceCount won={detail.won} played={played} />
        <p className="flex gap-3 text-body">
          <span className="text-muted-foreground">{t("worstStreak")}</span>
          <span className="score font-semibold">
            {t("worstValueAi", { count: worst })}
          </span>
        </p>
      </Block>

      <Figures
        comparison={detail.comparison}
        francs={detail.francs}
        settled={played}
        unit="opinion"
        t={t}
        locale={locale}
        chancesHint={visitor ? null : await chancesHintOf(locale)}
      />

      <Block title={t("opinionByOpinion")}>
        {detail.opinions.length === 0 ? (
          <p className="text-body text-muted-foreground">{t("nothing")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.opinions.flatMap((o, index) => {
              const row = (
                <DayRow
                  key={`${o.date}-${index}`}
                  date={day(o.date, locale)}
                  outcome={o.outcome}
                  text={[o.label, betOf(o.label, o.market, o.pick)]
                    .filter(Boolean)
                    .join(" · ")}
                  odds={formatOdds(o.odds, locale)}
                  href={null}
                  t={t}
                />
              );
              // The opinions before a change stay, the change is marked.
              return o.settingChanged
                ? [
                    row,
                    <li
                      key={`change-${index}`}
                      className="py-2 text-meta font-medium text-muted-foreground"
                    >
                      {t("settingChanged", { date: day(o.date, locale) })}
                    </li>,
                  ]
                : [row];
            })}
          </ul>
        )}
      </Block>
    </div>
  );
}

async function AdviceCount({ won, played }: { won: number; played: number }) {
  const results = await getTranslations("results");
  return (
    <p className="score text-body font-semibold">
      {results("adviceWon", { won, played })}
    </p>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 py-4">
      <h3 className="text-meta text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Announced against realised, then the francs (08 § 2): dated, counted,
 * never a percentage nor a verdict. Too early: one line in their place.
 */
function Figures({
  comparison,
  francs,
  settled,
  unit,
  t,
  locale,
  chancesHint,
}: {
  comparison: ResultsComparison | null;
  francs: ResultsFrancs | null;
  settled: number;
  unit: "day" | "opinion";
  t: Translate;
  locale: DisplayLocale;
  /** Null: no « ? », its help sheet is behind the session. */
  chancesHint: string | null;
}) {
  if (!comparison && !francs) {
    return (
      <p className="py-4 text-body text-muted-foreground">
        {t("tooEarlyCompare", { count: settled })}
      </p>
    );
  }
  const chance = (value: number) =>
    unit === "opinion" ? (
      <span className="score text-bet font-bold">
        {t("outOfHundred", { count: Math.round(value * 100) })}
      </span>
    ) : (
      <ChanceFigure probability={value} showLeds={false} size="sm" />
    );
  return (
    <>
      {comparison ? (
        <section className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 py-4">
          <span className="text-body text-muted-foreground">
            {t("announced")}
            {chancesHint ? (
              <HelpHint slug="chances" label={chancesHint} />
            ) : null}
          </span>
          <span>{chance(comparison.announced)}</span>
          <span className="text-body text-muted-foreground">
            {t("realised")}
          </span>
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            {chance(comparison.realised)}
            {comparison.from && comparison.to ? (
              <span className="text-meta text-muted-foreground">
                {t(unit === "opinion" ? "comparedOnAi" : "comparedOn", {
                  from: day(comparison.from, locale),
                  to: day(comparison.to, locale),
                  count: comparison.days,
                })}
              </span>
            ) : null}
          </span>
        </section>
      ) : null}
      {francs ? (
        <section className="flex flex-col gap-1 py-4">
          <h3 className="text-meta text-muted-foreground">
            {t(unit === "opinion" ? "francsAdvice" : "francsDay")}
          </h3>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-body">
              <span className="text-muted-foreground">{t("staked")} </span>
              <span className="score font-semibold">
                {formatFrancs(francs.staked, locale)}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {t("returned")}{" "}
              </span>
              <span className="score font-semibold">
                {formatFrancs(francs.returned, locale)}
              </span>
            </span>
            {francs.from && francs.to ? (
              <span className="text-meta text-muted-foreground">
                {t("francsOn", {
                  from: day(francs.from, locale),
                  to: day(francs.to, locale),
                })}
              </span>
            ) : null}
          </p>
          {francs.unpricedDays > 0 ? (
            <p className="text-meta text-muted-foreground">
              {t("unpriced", { count: francs.unpricedDays })}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

/** A day (or an opinion) of the list: date, mark, match and bet, odds paid. */
function DayRow({
  date,
  outcome,
  text,
  odds,
  href,
  t,
}: {
  date: string;
  outcome: string;
  text: string;
  odds: string | null;
  href: string | null;
  t: Translate;
}) {
  const kind =
    outcome === "won"
      ? "won"
      : outcome === "lost"
        ? "lost"
        : outcome === "refunded"
          ? "void"
          : null;
  const body = (
    <>
      <span className="score w-11 shrink-0 text-meta text-muted-foreground">
        {date}
      </span>
      <span className="flex w-5 shrink-0 justify-center">
        {kind ? (
          <ResultMark
            kind={kind}
            size="sm"
            label={t(kind === "void" ? "refunded" : kind)}
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-body">{text}</span>
      {odds ? (
        <span className="score shrink-0 text-body font-semibold">{odds}</span>
      ) : null}
    </>
  );
  if (!href) {
    return <li className="flex min-h-12 items-center gap-3 py-2">{body}</li>;
  }
  return (
    <li>
      <Link
        href={href}
        className="-mx-2 flex min-h-12 items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {body}
        <ChevronRight
          aria-hidden
          strokeWidth={2}
          className="size-4 shrink-0 text-icon-subtle"
        />
      </Link>
    </li>
  );
}
