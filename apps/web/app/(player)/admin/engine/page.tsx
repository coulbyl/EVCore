import type { Metadata } from "next";
import Link from "next/link";
import { clsx } from "clsx";
import { getLocale, getTranslations } from "next-intl/server";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import {
  getEngineChannels,
  getEngineProducts,
  getSuspensions,
} from "@/domains/console/use-cases/get-console";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { AdminBand } from "../components/admin-band";
import { ReactivateMarket } from "./components/reactivate-market";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: `${t("titles.engine")} — EVCore`, robots: { index: false } };
}

const PERIODS = ["30", "90", "all"] as const;
// Alerts come first: past these, the search narrows the list.
const CELLS_SHOWN = 50;

/**
 * Moteur — « tient-il ce qu'il annonce ? » (12-admin.md § 2, maquettes
 * MoteurMobile, Moteur): products with what a player never sees, the
 * channel × competition calibration with « seulement les alertes », and
 * the suspended markets with Réactiver. One period switch, one search.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; alerts?: string; q?: string }>;
}) {
  const params = await searchParams;
  const period = PERIODS.find((p) => p === params.period) ?? "90";
  const onlyAlerts = params.alerts === "1";
  const query = (params.q ?? "").trim().toLowerCase();
  const [t, results, today, locale, products, channels, suspensions] =
    await Promise.all([
      getTranslations("console"),
      getTranslations("results"),
      getTranslations("today"),
      getLocale(),
      getEngineProducts(period),
      getEngineChannels(),
      getSuspensions(),
    ]);
  const display = displayLocaleOf(locale);
  const intl = display === "en" ? "en-GB" : "fr-FR";
  const pct = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat(intl, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(v);
  const signed = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat(intl, {
          signDisplay: "exceptZero",
          maximumFractionDigits: 1,
        }).format(v * 100);
  const ratio = (v: number | null) =>
    v === null
      ? "—"
      : new Intl.NumberFormat(intl, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(v);
  const day = (iso: string) =>
    formatShortDate(new Date(`${iso.slice(0, 10)}T12:00:00Z`), display, "UTC");
  const name = (key: string) =>
    today.has(`products.${key}`)
      ? today(`products.${key}`)
      : results.has(`names.${key}`)
        ? results(`names.${key}`)
        : key;
  const href = (over: { period?: string; alerts?: boolean; q?: string }) => {
    const p = new URLSearchParams();
    const next = { period, alerts: onlyAlerts, q: params.q ?? "", ...over };
    if (next.period !== "90") p.set("period", next.period);
    if (next.alerts) p.set("alerts", "1");
    if (next.q) p.set("q", next.q);
    const s = p.toString();
    return s ? `/admin/engine?${s}` : "/admin/engine";
  };
  const cells = channels.filter(
    (c) =>
      (!onlyAlerts || c.word === "alert") &&
      (!query ||
        c.competitionCode.toLowerCase().includes(query) ||
        c.competitionName.toLowerCase().includes(query)),
  );
  const heading = "text-meta font-semibold text-muted-foreground";

  return (
    <>
      <AdminBand current="engine" />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-4 lg:px-6">
        <ChipGroup
          label={results("periods.label")}
          items={PERIODS.map((p) => ({
            key: p,
            label: results(`periods.${p}`),
            href: href({ period: p }),
            active: p === period,
          }))}
        />

        <section
          aria-labelledby="products-title"
          className="flex flex-col gap-1"
        >
          <h2 id="products-title" className={heading}>
            {t("engine.productsTitle")}
          </h2>
          <ul className="divide-y divide-border">
            {products.products.map((p) => (
              <li key={p.product} className="flex flex-col gap-0.5 py-2.5">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-body font-semibold">
                    {name(p.product)}
                    {p.retired ? (
                      <span className="ms-2 text-meta font-normal text-muted-foreground">
                        {t("engine.retired")}
                      </span>
                    ) : null}
                  </span>
                  <span className="score text-body">
                    {t("engine.days", { count: p.won + p.lost })} ·{" "}
                    {t("engine.won", { count: p.won })}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-3 text-meta text-muted-foreground">
                  <span>
                    {p.tooEarly
                      ? t("engine.tooEarly")
                      : t("engine.announcedRealised", {
                          announced: pct(p.announced),
                          realised: pct(p.realised),
                        })}
                  </span>
                  <span>{t("engine.clv", { value: signed(p.clv) })}</span>
                  <span>{t("engine.margin", { value: pct(p.margin) })}</span>
                  <span>{t("engine.legs", { count: p.legs })}</span>
                </span>
              </li>
            ))}
            <li className="flex flex-col gap-0.5 py-2.5">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-body font-semibold">
                    {t("engine.ai")}
                  </span>
                  <span className="score text-body">
                    {t("engine.aiOpinions", {
                      count: products.ai.won + products.ai.lost,
                    })}{" "}
                    · {t("engine.won", { count: products.ai.won })}
                  </span>
                </summary>
                <p className="text-meta text-muted-foreground">
                  {t("engine.announcedRealised", {
                    announced: pct(products.ai.announced),
                    realised: pct(products.ai.realised),
                  })}{" "}
                  · {t("engine.margin", { value: pct(products.ai.margin) })}
                </p>
                <ul className="mt-2 flex flex-col gap-1 border-s-2 border-border ps-3">
                  {products.ai.versions.map((v) => (
                    <li key={v.version} className="text-meta">
                      <span className="font-medium">
                        {t("engine.version", {
                          version: v.version,
                          from: day(v.from),
                          to: day(v.to),
                        })}
                      </span>
                      <span className="block text-muted-foreground">
                        {t("engine.won", { count: v.won })} / {v.won + v.lost} ·{" "}
                        {pct(v.announced)} ·{" "}
                        {t("engine.margin", { value: pct(v.margin) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          </ul>
        </section>

        <section
          aria-labelledby="channels-title"
          className="flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="channels-title" className={heading}>
              {t("engine.channelsTitle")}
            </h2>
            <ChipGroup
              label={t("engine.channelsTitle")}
              items={[
                {
                  key: "all",
                  label: t("engine.allCells"),
                  href: href({ alerts: false }),
                  active: !onlyAlerts,
                },
                {
                  key: "alerts",
                  label: t("engine.onlyAlerts"),
                  href: href({ alerts: true }),
                  active: onlyAlerts,
                },
              ]}
            />
          </div>
          <form action="/admin/engine" method="get" className="flex gap-2">
            {period !== "90" ? (
              <input type="hidden" name="period" value={period} />
            ) : null}
            {onlyAlerts ? (
              <input type="hidden" name="alerts" value="1" />
            ) : null}
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              aria-label={t("engine.search")}
              placeholder={t("engine.search")}
              className="min-h-11 flex-1 rounded-full border border-border bg-card px-4 text-body"
            />
            <button
              type="submit"
              className="min-h-11 rounded-full border border-border px-4 text-body font-medium"
            >
              {t("engine.searchSubmit")}
            </button>
          </form>
          {cells.length === 0 ? (
            <p className="text-body text-muted-foreground">
              {t("engine.noCells")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {cells.slice(0, CELLS_SHOWN).map((c) => (
                <li
                  key={`${c.channel}-${c.competitionCode}`}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 py-2"
                >
                  <span className="min-w-0 text-body">
                    <span className="font-medium">{c.channel}</span>{" "}
                    <span className="text-muted-foreground">
                      {c.competitionCode}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "score text-meta",
                      c.word === "alert"
                        ? "text-loss"
                        : c.word === "optimistic"
                          ? "text-warning"
                          : "text-muted-foreground",
                    )}
                  >
                    {t(`engine.words.${c.word}`)}
                  </span>
                  <span className="score text-meta text-muted-foreground">
                    {t("engine.sample", { count: c.sample })} · {ratio(c.ratio)}
                    {c.low !== null && c.high !== null
                      ? ` [${ratio(c.low)}–${ratio(c.high)}]`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cells.length > CELLS_SHOWN ? (
            <p className="text-meta text-muted-foreground">
              {t("engine.moreCells", { count: cells.length - CELLS_SHOWN })}
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="suspended-title"
          className="flex flex-col gap-1"
        >
          <h2 id="suspended-title" className={heading}>
            {t("engine.suspendedTitle")}
          </h2>
          {suspensions.length === 0 ? (
            <p className="text-body text-muted-foreground">
              {t("engine.noneSuspended")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {suspensions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body font-medium">{s.market}</span>
                    <span className="text-meta text-muted-foreground">
                      {t("engine.since", { date: day(s.since) })} · {s.reason}
                    </span>
                  </span>
                  <ReactivateMarket
                    id={s.id}
                    labels={{
                      action: t("engine.reactivate"),
                      title: t("engine.reactivateTitle", { market: s.market }),
                      reason: t("engine.reactivateReason"),
                      confirm: t("engine.reactivateConfirm"),
                      cancel: t("engine.cancel"),
                      failed: t("engine.reactivateFailed"),
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <Link href="/admin" className="sr-only">
          {t("titles.home")}
        </Link>
      </div>
    </>
  );
}
