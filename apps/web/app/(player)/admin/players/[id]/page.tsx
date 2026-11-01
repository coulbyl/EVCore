import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { getPlayer } from "@/domains/console/use-cases/get-console";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { displayLocaleOf, formatShortDate } from "@/helpers/scoreboard-format";
import { AdminBand } from "../../components/admin-band";
import { PlayerActions } from "../components/player-actions";
import { StartConversation } from "../components/start-conversation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("console");
  return { title: `${t("titles.players")} — EVCore`, robots: { index: false } };
}

/** A player's sheet (12-admin.md § 3): followed coupons, thread, actions. */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, m, today, locale, timeZone] = await Promise.all([
    getTranslations("console.players"),
    getTranslations("console.messages"),
    getTranslations("today"),
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const [player, current] = await Promise.all([
    getPlayer(id).catch(() => null),
    getPlayerSession(),
  ]);
  // One's own account: the server refuses role, suspension and deletion.
  const self = current.status === "signed-in" && current.session.user.id === id;
  if (!player) notFound();
  const display = displayLocaleOf(locale);
  const day = (iso: string) =>
    formatShortDate(new Date(iso), display, timeZone);
  const heading = "text-meta font-semibold text-muted-foreground";

  return (
    <>
      <AdminBand current="players" />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-4 lg:px-6">
        <Link
          href="/admin/players"
          className="text-meta font-medium underline-offset-4 hover:underline"
        >
          ‹ {t("sheet.back")}
        </Link>
        <section className="flex flex-col gap-0.5">
          <p className="score text-title font-semibold">{player.name}</p>
          <p className="text-body text-muted-foreground">{player.email}</p>
          <p className="text-meta text-muted-foreground">
            {t(`roles.${player.role}`)} ·{" "}
            {t("createdOn", { date: day(player.createdAt) })} ·{" "}
            {player.lastSeenAt
              ? t("lastSeen", { date: day(player.lastSeenAt) })
              : t("neverSeen")}{" "}
            ·{" "}
            {player.emailVerified
              ? t("sheet.verified")
              : t("sheet.notVerified")}
            {player.pausedUntil
              ? ` · ${t("pausedUntil", { date: day(player.pausedUntil) })}`
              : ""}
            {player.suspended ? ` · ${t("suspended")}` : ""}
          </p>
        </section>

        <section
          aria-labelledby="followed-title"
          className="flex flex-col gap-1"
        >
          <h2 id="followed-title" className={heading}>
            {t("sheet.followed")} · {player.follows}
          </h2>
          {player.followed.length === 0 ? (
            <p className="text-body text-muted-foreground">
              {t("sheet.noFollowed")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {player.followed.map((f) => (
                <li
                  key={f.couponId}
                  className="flex items-center justify-between gap-3 py-2 text-body"
                >
                  <span>
                    <span className="score text-muted-foreground">
                      {day(`${f.forDate}T12:00:00Z`)}
                    </span>{" "}
                    {f.product && today.has(`products.${f.product}`)
                      ? today(`products.${f.product}`)
                      : (f.product ?? "—")}
                  </span>
                  <span className="text-meta text-muted-foreground">
                    {f.outcome ? t(`sheet.outcomes.${f.outcome}`) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {player.conversationId ? (
          <Link
            href={`/admin/messages/${player.conversationId}`}
            className="flex min-h-12 items-center border-y border-border text-body font-medium"
          >
            {t("sheet.thread")} ›
          </Link>
        ) : (
          <StartConversation
            userId={player.id}
            labels={{ write: m("write"), failed: m("writeFailed") }}
          />
        )}

        {self ? null : (
          <section
            aria-labelledby="actions-title"
            className="flex flex-col gap-2"
          >
            <h2 id="actions-title" className={heading}>
              {t("sheet.actions")}
            </h2>
            <PlayerActions
              id={player.id}
              role={player.role}
              suspended={player.suspended}
              labels={{
                makeAdmin: t("sheet.makeAdmin"),
                makePlayer: t("sheet.makePlayer"),
                suspend: t("sheet.suspend"),
                unsuspend: t("sheet.unsuspend"),
                resetLink: t("sheet.resetLink"),
                delete: t("sheet.delete"),
                deleteConfirm: t("sheet.deleteConfirm", { name: player.name }),
                confirm: t("sheet.confirm"),
                cancel: t("sheet.cancel"),
                failed: t("sheet.failed"),
                copied: t("sheet.copied"),
              }}
            />
          </section>
        )}
      </div>
    </>
  );
}
