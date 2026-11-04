import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import { getNotifications } from "@/domains/notifications/use-cases/get-notifications";
import {
  feedHref,
  hrefOf,
  parseFeedFilter,
  type FeedFilter,
} from "@/domains/notifications/helpers/notification-feed";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { ChipGroup } from "@/components/scoreboard/ui/chip-group";
import {
  displayLocaleOf,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { RichText } from "@/components/scoreboard/ui/rich-text";
import { plainTextOf } from "@/helpers/plain-text";
import { NotificationLink } from "./components/notification-link";
import { MarkAllRead } from "./components/mark-all-read";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("playerNotifications");
  return { title: `${t("title")} — EVCore` };
}

const PAGE = 30;
const MAX_PAGES = 5;
const INTL: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * La cloche (09 § 6, maquette Cloche) : une liste sans onglet, les plus
 * récentes d'abord — la matinée, la semaine, le résultat des coupons
 * suivis, les réponses de l'équipe, une annonce de temps en temps. Les
 * non-lues en gras avec leur point ; toucher une ligne la marque lue et
 * mène où elle parle. Les alertes d'exploitation ne viennent jamais ici
 * (le serveur ne les sert qu'à l'admin).
 *
 * Filtres demandés le 04/11 (09 § 6 disait « pas d'onglets ») : Toutes ·
 * Non lues · Lues pour tous, et pour l'admin, dont la cloche reçoit aussi
 * les alertes techniques, Tout · Joueur · Alertes techniques. Le serveur
 * filtre (jamais une page filtrée dans le navigateur) et le compte des non
 * lues de la puce est celui de la même requête.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ more?: string; status?: string; kind?: string }>;
}) {
  const [t, shell, params, locale, timeZone, session] = await Promise.all([
    getTranslations("playerNotifications"),
    getTranslations("shell"),
    searchParams,
    getLocale(),
    getPlayerTimeZone(),
    getPlayerSession(),
  ]);
  const admin =
    session.status === "signed-in" && session.session.user.role === "ADMIN";
  const filter = parseFeedFilter(params, admin);
  const display = displayLocaleOf(locale);
  const pages = Math.min(MAX_PAGES, 1 + Math.max(0, Number(params.more) || 0));
  // The unread of the kind shown: the chip's count and « tout marquer »,
  // from the same filter as the list (a read list has none to count).
  const [{ data, total }, unread] = await Promise.all([
    getNotifications(filter.status, filter.kind, PAGE * pages),
    filter.status === "read"
      ? Promise.resolve(null)
      : getNotifications("unread", filter.kind, 1),
  ]);
  const unreadTotal = unread?.total ?? 0;
  const statusChips = (["all", "unread", "read"] as const).map((status) => ({
    key: status,
    label:
      status === "all"
        ? t("statusAll")
        : status === "read"
          ? t("statusRead")
          : unreadTotal > 0
            ? t("statusUnreadCount", { count: unreadTotal })
            : t("statusUnread"),
    href: feedHref({ ...filter, status }),
    active: filter.status === status,
  }));
  const kindChips = (["all", "player", "technical"] as const).map((kind) => ({
    key: kind,
    label:
      kind === "all"
        ? t("kindAll")
        : kind === "player"
          ? t("kindPlayer")
          : t("kindTechnical"),
    href: feedHref({ ...filter, kind }),
    active: filter.kind === kind,
  }));

  const dayOf = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
  const today = dayOf(new Date());
  const yesterday = dayOf(new Date(Date.now() - 86_400_000));
  const when = (iso: string) => {
    const date = new Date(iso);
    const key = dayOf(date);
    const day =
      key === today
        ? t("today")
        : key === yesterday
          ? t("yesterday")
          : Date.now() - date.getTime() < 6 * 86_400_000
            ? new Intl.DateTimeFormat(INTL[display], {
                weekday: "short",
                timeZone,
              }).format(date)
            : formatShortDate(date, display, timeZone);
    return { day, time: formatTime(date, display, timeZone) };
  };

  return (
    <>
      <SubpageBand
        title={t("title")}
        back={{ href: "/today", label: shell("tabs.today") }}
      />
      <div className="flex flex-col px-4 pb-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <ChipGroup label={t("filterStatus")} items={statusChips} />
          {unreadTotal > 0 ? (
            <MarkAllRead kind={filter.kind} label={t("markAllRead")} />
          ) : null}
        </div>
        {/* An admin's bell also holds the technical alerts (ETL, stats,
            engine): a second row of chips, the admin's only. */}
        {admin ? (
          <ChipGroup
            label={t("filterKind")}
            items={kindChips}
            className="pb-2"
          />
        ) : null}
        {data.length === 0 ? (
          <p className="py-6 text-body text-muted-foreground">
            {emptyText(filter, t)}
          </p>
        ) : (
          <ul aria-label={t("title")} className="divide-y divide-border">
            {data.map((notification) => {
              const { day, time } = when(notification.createdAt);
              const href = hrefOf(notification.type);
              // A row that leads somewhere shows two lines: a technical
              // alert's list of raw ids is read whole on its admin screen.
              const clamp = href !== null;
              const unread = !notification.isRead;
              const body = (
                <>
                  <span className="score flex w-12 shrink-0 flex-col text-meta text-muted-foreground">
                    <span>{day}</span>
                    <span>{time}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={
                        unread ? "text-body font-semibold" : "text-body"
                      }
                    >
                      {unread ? (
                        <span
                          aria-label={t("unread")}
                          role="img"
                          className="me-1.5 inline-block size-2 rounded-full bg-led-on align-middle"
                        />
                      ) : null}
                      {plainTextOf(notification.title)}
                    </span>
                    {/* Announcements are written as formatted text: drawn
                        safely; inside a row that is a link, no nested link. */}
                    <RichText
                      html={notification.body}
                      linkable={!href}
                      phrasing
                      className={
                        clamp
                          ? "line-clamp-2 break-words text-meta text-muted-foreground"
                          : "text-meta text-muted-foreground"
                      }
                    />
                  </span>
                  {href ? (
                    <ChevronRight
                      aria-hidden
                      strokeWidth={2}
                      className="mt-1 size-[1.125rem] shrink-0 text-icon-subtle"
                    />
                  ) : null}
                </>
              );
              return (
                <li key={notification.id}>
                  {/* An announcement shows here in full: touching it
                      marks it read and reads the list again. */}
                  <NotificationLink
                    id={notification.id}
                    href={href ?? "/notifications"}
                    unread={unread}
                  >
                    {body}
                  </NotificationLink>
                </li>
              );
            })}
          </ul>
        )}
        {data.length < total && pages < MAX_PAGES ? (
          <Link
            href={feedHref(filter, pages)}
            scroll={false}
            className="flex min-h-11 items-center text-body font-medium underline-offset-4 hover:underline"
          >
            {t("seeMore")}
          </Link>
        ) : null}
        <p className="pt-4 text-meta text-muted-foreground">
          {t("note")}{" "}
          <Link href="/me/account" className="underline underline-offset-4">
            {t("settings")}
          </Link>
        </p>
      </div>
    </>
  );
}

function emptyText(
  filter: FeedFilter,
  t: (key: "empty" | "emptyUnread" | "emptyRead" | "emptyTechnical") => string,
): string {
  if (filter.status === "unread") return t("emptyUnread");
  if (filter.status === "read") return t("emptyRead");
  if (filter.kind === "technical") return t("emptyTechnical");
  return t("empty");
}
