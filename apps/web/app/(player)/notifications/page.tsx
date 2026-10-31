import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SubpageBand } from "@/components/scoreboard/shell/subpage-band";
import { getPlayerTimeZone } from "@/domains/preferences/get-player-time-zone";
import {
  getNotifications,
  type PlayerNotification,
} from "@/domains/notifications/use-cases/get-notifications";
import {
  displayLocaleOf,
  formatShortDate,
  formatTime,
} from "@/helpers/scoreboard-format";
import { NotificationLink } from "./components/notification-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: `${t("title")} — EVCore` };
}

const PAGE = 30;
const MAX_PAGES = 5;
const INTL: Record<string, string> = { fr: "fr-FR", en: "en-GB" };

/** Where each of the four kinds leads (09 § 6); an announcement shows here. */
function hrefOf(notification: PlayerNotification): string | null {
  switch (notification.type) {
    case "MORNING_BRIEF":
      return "/today";
    case "WEEKLY_STATEMENT":
      return "/results/week";
    case "FOLLOWED_SETTLED":
      return "/me?tab=settled";
    case "SUPPORT_MESSAGE":
      return "/me/messages";
    default:
      return null;
  }
}

/**
 * La cloche (09 § 6, maquette Cloche) : une liste sans onglet, les plus
 * récentes d'abord — la matinée, la semaine, le résultat des coupons
 * suivis, les réponses de l'équipe, une annonce de temps en temps. Les
 * non-lues en gras avec leur point ; toucher une ligne la marque lue et
 * mène où elle parle. Les alertes d'exploitation ne viennent jamais ici
 * (le serveur ne les sert qu'à l'admin).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ more?: string }>;
}) {
  const [t, shell, params, locale, timeZone] = await Promise.all([
    getTranslations("notifications"),
    getTranslations("shell"),
    searchParams,
    getLocale(),
    getPlayerTimeZone(),
  ]);
  const display = displayLocaleOf(locale);
  const pages = Math.min(MAX_PAGES, 1 + Math.max(0, Number(params.more) || 0));
  const { data, total } = await getNotifications(PAGE * pages);

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
        {data.length === 0 ? (
          <p className="py-6 text-body text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul aria-label={t("title")} className="divide-y divide-border">
            {data.map((notification) => {
              const { day, time } = when(notification.createdAt);
              const href = hrefOf(notification);
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
                      {notification.title}
                    </span>
                    <span
                      className={
                        href
                          ? "line-clamp-2 text-meta text-muted-foreground"
                          : "whitespace-pre-line text-meta text-muted-foreground"
                      }
                    >
                      {notification.body}
                    </span>
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
            href={`/notifications?more=${pages}`}
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
