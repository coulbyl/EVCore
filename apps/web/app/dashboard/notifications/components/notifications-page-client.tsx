"use client";

import { useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Skeleton, cn } from "@evcore/ui";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from "@/domains/notification/use-cases/use-notifications";
import type { NotificationCategory } from "@/domains/notification/types/notification";
import { groupByDay } from "./notification-constants";
import { NotificationRow } from "./notification-row";

type Tab = "all" | "unread" | NotificationCategory;

const PAGE_SIZE = 20;

export function NotificationsPageClient() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("all");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError, refetch } = useNotifications({
    limit: PAGE_SIZE,
    offset,
    unread: tab === "unread" ? true : undefined,
    category: tab === "announcement" || tab === "alert" ? tab : undefined,
  });
  const { data: unreadData } = useUnreadCount();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();

  const notifications = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;
  const unreadCount = unreadData?.count ?? 0;

  function selectTab(next: Tab) {
    setTab(next);
    setOffset(0);
  }

  function dayLabel(day: string): string {
    const date = new Date(day);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t("today");
    if (date.toDateString() === yesterday.toDateString()) return t("yesterday");
    return date.toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  // Le joueur ne reçoit que des annonces et des réponses de l'équipe :
  // « Annonces » doublait « Toutes », « Alertes » restait vide (revue UX du
  // 2026-10-27). Les admins gardent les deux filtres.
  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: t("all") },
    { id: "unread", label: t("unread") },
    ...(isAdmin
      ? [
          { id: "announcement" as const, label: t("announcements") },
          { id: "alert" as const, label: t("alerts") },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {/* Onglets collants : ils restent à portée pendant le défilement. */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 bg-panel-strong px-4 pb-3 pt-1 sm:-mx-5 sm:px-5">
        <div className="flex max-w-full flex-nowrap gap-1 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => selectTab(item.id)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl px-4 text-sm font-medium transition-colors",
                tab === item.id
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.label}
              {item.id === "unread" && unreadCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-bold text-destructive-foreground tabular-nums">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          className="h-11 rounded-2xl"
          onClick={() => markAllRead()}
          disabled={markingAll || unreadCount === 0}
        >
          <CheckCheck size={14} />
          {t("markAllRead")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[1.2rem]" />
          ))}
        </div>
      ) : isError ? (
        // Un échec de chargement affichait « Tout est à jour ».
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="font-semibold text-foreground">{t("loadError")}</p>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => void refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
          <span className="inline-flex size-14 items-center justify-center rounded-[1.2rem] border border-border bg-panel-strong">
            <BellOff size={28} className="opacity-40" />
          </span>
          <div className="text-center">
            <p className="font-semibold text-foreground">
              {tab === "unread" ? t("emptyUnread") : t("empty")}
            </p>
            {tab === "unread" ? null : (
              <p className="mt-1 text-sm">{t("emptyDescription")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupByDay(notifications).map(({ day, items }) => (
            <section key={day} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {dayLabel(day)}
                <span aria-hidden className="flex-1 border-t border-border" />
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    isAdmin={isAdmin}
                    onMarkRead={(id) => markRead(id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasPrev || hasMore ? (
        <div className="flex justify-center gap-3">
          {hasPrev ? (
            <Button
              variant="outline"
              className="h-11 rounded-2xl"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("newer")}
            </Button>
          ) : null}
          {hasMore ? (
            <Button
              variant="outline"
              className="h-11 rounded-2xl"
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t("older")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
