import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  getConsolePasses,
  getConsoleStatus,
} from "@/domains/console/use-cases/get-console";
import type { PassView, TodoItem } from "@/domains/console/types/console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { getToday } from "@/domains/today/use-cases/get-today";
import {
  displayLocaleOf,
  formatOdds,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { AdminBand } from "./components/admin-band";
import { neverKey } from "./components/console-constants";
import { LightsRow } from "./components/lights-row";
import { PassesList } from "./components/passes-list";
import { TodoList } from "./components/todo-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: `${t("titles.home")} — EVCore`, robots: { index: false } };
}

/**
 * Accueil admin — « tout tourne ? » (12-admin.md § 1, maquettes AdminMobile,
 * Admin): the three lights, « À faire », the day's passes with Relancer,
 * and today's coupons with three players' figures. Nothing else.
 */
export default async function Page() {
  const [t, today, locale, timeZone, status, passes, now] = await Promise.all([
    getTranslations("console"),
    getTranslations("today"),
    getLocale(),
    getPlayerTimeZone(),
    getConsoleStatus(),
    getConsolePasses(),
    getToday(),
  ]);
  const display = displayLocaleOf(locale);
  const time = (iso: string) => formatTime(new Date(iso), display, timeZone);
  const day = (iso: string) =>
    formatShortDate(new Date(iso), display, timeZone);
  const productName = (key: string) =>
    today.has(`products.${key}`) ? today(`products.${key}`) : key;

  const todoText = (item: TodoItem): string => {
    const key = `todo.${neverKey(item)}`;
    switch (item.kind) {
      case "coupons_missing":
        return t(key, {
          date: formatShortDate(
            new Date(`${item.forDate}T12:00:00Z`),
            display,
            "UTC",
          ),
        });
      case "market_suspended":
        return t(key, {
          market: item.market,
          date: formatShortDate(
            new Date(`${item.since}T12:00:00Z`),
            display,
            "UTC",
          ),
        });
      case "product_absent":
        return t(key, {
          product: productName(item.product),
          days: item.days,
          window: item.window,
        });
      case "etl_failed":
        return t(key, { count: item.count, last: item.last });
      case "quota":
        return t(key, { detail: item.detail });
      case "stats_late":
        return t(key, {
          fixtures: item.fixtures,
          competitions: item.competitions,
        });
      case "support_unanswered":
        return t(key, { count: item.count });
      default:
        return t(key, { hours: item.hours ?? 0 });
    }
  };

  const passState = (pass: PassView): string => {
    switch (pass.state) {
      case "done":
        return pass.jobs > 1 && pass.lastAt
          ? t("passState.doneJobs", {
              time: time(pass.lastAt),
              jobs: pass.jobs,
            })
          : t("passState.done", {
              time: pass.lastAt ? time(pass.lastAt) : pass.at,
            });
      case "running":
        return t("passState.running", {
          minutes: pass.runningSince
            ? Math.max(
                0,
                Math.round(
                  (Date.now() - Date.parse(pass.runningSince)) / 60_000,
                ),
              )
            : 0,
        });
      default:
        return t(`passState.${pass.state}`);
    }
  };

  const codes = (key: string) =>
    today.has(`codes.${key}`) ? today(`codes.${key}`) : key;

  return (
    <>
      <AdminBand current="home" />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-4 lg:px-6">
        {status.passesOff ? (
          <p
            role="alert"
            className="rounded-[0.875rem] bg-loss px-4 py-3 text-body font-semibold text-white"
          >
            {status.passesOff.by
              ? t("passesOff", {
                  date: `${day(status.passesOff.since)} ${time(status.passesOff.since)}`,
                  by: status.passesOff.by,
                })
              : t("passesOffAnonymous", {
                  date: `${day(status.passesOff.since)} ${time(status.passesOff.since)}`,
                })}
          </p>
        ) : null}
        <LightsRow
          status={status}
          timeOf={time}
          labels={{
            names: {
              data: t("lights.data"),
              engine: t("lights.engine"),
              players: t("lights.players"),
            },
            states: {
              green: t("lightStates.green"),
              orange: t("lightStates.orange"),
              red: t("lightStates.red"),
            },
            redSince: (at) => t("redSince", { time: at }),
          }}
        />
        <TodoList
          items={status.todo}
          textOf={todoText}
          labels={{ title: t("todoTitle"), nothing: t("nothing") }}
        />
        <PassesList
          passes={passes}
          nameOf={(pass) => t(`passes.${pass.key}`)}
          stateOf={passState}
          labels={{
            title: t("passesTitle"),
            relaunch: t("relaunch"),
            relaunchFailed: t("relaunchFailed"),
          }}
        />
        <section aria-labelledby="today-title" className="flex flex-col gap-1">
          <h2
            id="today-title"
            className="text-meta font-semibold text-muted-foreground"
          >
            {t("todayTitle")}
          </h2>
          {now.coupons.length === 0 ? (
            <p className="text-body text-muted-foreground">{t("noCoupons")}</p>
          ) : (
            <p className="score flex flex-wrap gap-x-4 gap-y-1 text-body">
              {now.coupons.map((coupon) => (
                <span key={coupon.id} className="flex items-center gap-1.5">
                  <span className="font-semibold">{codes(coupon.product)}</span>
                  {coupon.state === "won" ? (
                    <span className="text-win">
                      ✓{" "}
                      {coupon.paidOdds
                        ? formatOdds(coupon.paidOdds, display)
                        : ""}
                    </span>
                  ) : coupon.state === "lost" ? (
                    <span className="text-loss">✗</span>
                  ) : coupon.odds ? (
                    <span className="text-muted-foreground">
                      {formatOdds(coupon.odds, display)}
                    </span>
                  ) : null}
                </span>
              ))}
            </p>
          )}
          <p className="text-meta text-muted-foreground">
            {t("yesterday", status.yesterday)}
          </p>
        </section>
      </div>
    </>
  );
}
