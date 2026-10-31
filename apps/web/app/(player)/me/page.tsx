import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import { Row, RowList } from "@/components/scoreboard/ui/row-list";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { getMe, getMeSettled } from "@/domains/me/use-cases/get-me";
import type { TodayCoupon } from "@/domains/today/types/today";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { FollowedRows } from "./components/followed-rows";
import { SignOutButton } from "./components/sign-out-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: `${t("tabs.me")} — EVCore` };
}

/** « Voir plus » pages read at most, on top of the first (30 each). */
const MAX_MORE = 10;

/**
 * « Moi » (09 § 1, maquette Moi) : le prénom et mon bilan des coupons
 * suivis, la bascule En cours · Réglés (la seule de l'écran), les quatre
 * lignes (Messages, Aide, Jeu responsable, Compte), « Se déconnecter » en
 * léger. Rendu côté serveur en une lecture (GET /me), plus les pages de
 * « Voir plus ». Ouvert pendant une pause : rien n'y propose de jouer.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; more?: string }>;
}) {
  const [shell, t, params, me, locale, timeZone] = await Promise.all([
    getTranslations("shell"),
    getTranslations("me"),
    searchParams,
    getMe(),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const settledTab = params.tab === "settled";
  const more = Math.min(MAX_MORE, Math.max(0, Number(params.more) || 0));

  // « Voir plus » reads the next pages after the first one, in order.
  let settled: TodayCoupon[] = me.settled.coupons;
  let cursor = me.settled.nextCursor;
  for (let page = 0; settledTab && page < more && cursor; page += 1) {
    const next = await getMeSettled(cursor);
    settled = [...settled, ...next.coupons];
    cursor = next.nextCursor;
  }

  const { record } = me;
  const followed = record.won + record.lost + record.refunded > 0;
  const shown = settledTab ? settled : me.inProgress;

  return (
    <>
      <PlayerBand />
      <h1 className="sr-only">{shell("tabs.me")}</h1>
      <div className="flex flex-col gap-4 px-4 pt-4 pb-4 lg:px-6">
        <section className="flex flex-col gap-1">
          <p className="score text-title font-semibold">{me.firstName}</p>
          {followed ? (
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="score text-bet font-semibold">
                {t("record", { won: record.won, lost: record.lost })}
                {record.refunded > 0
                  ? ` · ${t("refunded", { count: record.refunded })}`
                  : null}
              </span>
              {record.since ? (
                <span className="text-meta text-muted-foreground">
                  {t("since", {
                    date: formatShortDate(
                      new Date(record.since),
                      display,
                      timeZone,
                    ),
                  })}
                </span>
              ) : null}
            </p>
          ) : me.inProgress.length === 0 ? (
            <Link
              href="/today"
              className="text-body font-medium underline underline-offset-4"
            >
              {t("firstFollow")}
            </Link>
          ) : null}
        </section>

        <section className="flex flex-col gap-1">
          <ChipGroup
            label={t("tabs.label")}
            items={[
              {
                key: "running",
                label: t("tabs.running"),
                href: "/me",
                active: !settledTab,
              },
              {
                key: "settled",
                label: t("tabs.settled"),
                href: "/me?tab=settled",
                active: settledTab,
              },
            ]}
          />
          {shown.length === 0 ? (
            <p className="py-3 text-body text-muted-foreground">
              {settledTab ? t("noneSettled") : t("noneRunning")}
            </p>
          ) : (
            <FollowedRows
              coupons={shown}
              label={settledTab ? t("tabs.settled") : t("tabs.running")}
            />
          )}
          {settledTab && cursor ? (
            <Link
              href={`/me?tab=settled&more=${more + 1}`}
              scroll={false}
              className="flex min-h-11 items-center text-body font-medium underline-offset-4 hover:underline"
            >
              {t("seeMore")}
            </Link>
          ) : null}
        </section>

        <RowList className="border-y border-border">
          <Row
            href="/me/messages"
            title={t("rows.messages")}
            value={
              me.unreadReplies > 0 ? (
                <span className="text-body font-medium">
                  {t("replies", { count: me.unreadReplies })}
                </span>
              ) : undefined
            }
          />
          <Row href="/me/help" title={t("rows.help")} />
          <Row href="/me/responsible" title={t("rows.responsible")} />
          <Row href="/me/account" title={t("rows.account")} />
        </RowList>

        <SignOutButton
          labels={{ signOut: t("signOut"), failed: t("signOutFailed") }}
        />
      </div>
    </>
  );
}
