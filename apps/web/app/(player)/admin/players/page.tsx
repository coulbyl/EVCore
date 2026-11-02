import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getAccounts,
  getConsoleStatus,
  getPlayersMonth,
} from "@/domains/console/use-cases/get-console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { AdminBand } from "../components/admin-band";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: `${t("titles.players")} — EVCore`, robots: { index: false } };
}

/** « 2026-10 » before « 2026-11 ». */
function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 2, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Joueurs — « viennent-ils ? » (12-admin.md § 3, maquettes JoueursMobile,
 * Joueurs): the month in four figures (the previous one on touch), the
 * messages owed an answer, the accounts with their follows and pause, and
 * « Écrire une annonce ». No ranking, no balance, no stake.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const [t, locale, timeZone, month, accounts, status] = await Promise.all([
    getTranslations("console.players"),
    getLocale(),
    getPlayerTimeZone(),
    getPlayersMonth(params.month),
    getAccounts(q, page),
    getConsoleStatus(),
  ]);
  const display = displayLocaleOf(locale);
  const day = (iso: string) =>
    formatShortDate(new Date(iso), display, timeZone);
  const unanswered = status.todo.reduce(
    (n, item) => (item.kind === "support_unanswered" ? n + item.count : n),
    0,
  );
  const rate =
    month.morning.sent > 0
      ? new Intl.NumberFormat(display === "en" ? "en-GB" : "fr-FR", {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(month.morning.opened / month.morning.sent)
      : null;
  const heading = "text-meta font-semibold text-muted-foreground";
  const current = new Date().toISOString().slice(0, 7);

  return (
    <>
      <AdminBand current="players" />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-4 lg:px-6">
        <section aria-labelledby="month-title" className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="month-title" className={heading}>
              {t("monthTitle")} · {month.month}
            </h2>
            <Link
              href={
                month.month === current
                  ? `/admin/players?month=${previousMonth(month.month)}`
                  : "/admin/players"
              }
              className="text-meta font-medium underline-offset-4 hover:underline"
            >
              {month.month === current ? t("previousMonth") : t("currentMonth")}
            </Link>
          </div>
          <dl className="grid grid-cols-4 gap-2 pt-1">
            {[
              { value: String(month.signups), label: t("figures.signups") },
              { value: String(month.activated), label: t("figures.activated") },
              { value: String(month.active7), label: t("figures.active7") },
              { value: rate ?? "—", label: t("figures.morning") },
            ].map((figure) => (
              <div
                key={figure.label}
                className="flex flex-col-reverse gap-0.5 rounded-[0.75rem] border border-border bg-card px-2 py-2.5 text-center"
              >
                <dt className="text-legal text-muted-foreground">
                  {figure.label}
                </dt>
                <dd className="score text-figure font-bold">{figure.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Link
          href="/admin/players/announcements"
          className="flex min-h-12 items-center justify-between gap-3 border-y border-border py-2 text-body font-medium"
        >
          {t("announce")}
          <ChevronRight
            aria-hidden
            className="size-[1.125rem] text-icon-subtle"
          />
        </Link>

        <Link
          href="/admin/messages?from=players"
          className="flex min-h-12 items-center justify-between gap-3 border-y border-border py-2 text-body font-medium"
        >
          {t("unanswered")}
          <span className="flex items-center gap-2">
            <span className="score">{unanswered}</span>
            <ChevronRight
              aria-hidden
              className="size-[1.125rem] text-icon-subtle"
            />
          </span>
        </Link>

        <section
          aria-labelledby="accounts-title"
          className="flex flex-col gap-2"
        >
          <h2 id="accounts-title" className={heading}>
            {t("accountsTitle")}
          </h2>
          <form action="/admin/players" method="get" className="flex gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label={t("search")}
              placeholder={t("search")}
              className="min-h-11 flex-1 rounded-full border border-border bg-card px-4 text-body"
            />
            <button
              type="submit"
              className="min-h-11 rounded-full border border-border px-4 text-body font-medium"
            >
              {t("searchSubmit")}
            </button>
          </form>
          {accounts.items.length === 0 ? (
            <p className="text-body text-muted-foreground">{t("noAccounts")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {accounts.items.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/players/${a.id}`}
                    className="flex min-h-12 items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-medium">
                        {a.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          {a.email}
                        </span>
                      </span>
                      <span className="text-meta text-muted-foreground">
                        {t(`roles.${a.role}`)} ·{" "}
                        {a.lastSeenAt
                          ? t("lastSeen", { date: day(a.lastSeenAt) })
                          : t("neverSeen")}{" "}
                        · {t("follows", { count: a.follows })}
                        {a.pausedUntil
                          ? ` · ${t("pausedUntil", { date: day(a.pausedUntil) })}`
                          : ""}
                        {a.suspended ? ` · ${t("suspended")}` : ""}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-[1.125rem] shrink-0 text-icon-subtle"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {accounts.more ? (
            <Link
              href={`/admin/players?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="flex min-h-11 items-center text-body font-medium underline-offset-4 hover:underline"
            >
              {t("more")}
            </Link>
          ) : null}
        </section>
      </div>
    </>
  );
}
