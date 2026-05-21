"use client";

import { useState } from "react";
import { BellOff, CheckCheck, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Skeleton } from "@evcore/ui";
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
} from "@/domains/notification/use-cases/use-notifications";
import {
  NOTIFICATION_SEVERITY,
  type NotificationView,
  type NotificationSeverity,
} from "@/domains/notification/types/notification";

const SEVERITY_STYLES: Record<NotificationSeverity, string> = {
  high: "border-l-destructive bg-destructive/5",
  medium: "border-l-warning bg-warning/5",
  low: "border-l-border bg-background/30",
};

const SEVERITY_BADGE: Record<NotificationSeverity, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-warning/15 text-warning",
  low: "bg-secondary text-muted-foreground",
};

function formatAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}

function formatDayLabel(createdAt: string): string {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function dayKey(createdAt: string): string {
  return new Date(createdAt).toDateString();
}

function groupByDay(
  notifications: NotificationView[],
): Array<{ day: string; label: string; items: NotificationView[] }> {
  const groups: Array<{
    day: string;
    label: string;
    items: NotificationView[];
  }> = [];
  for (const n of notifications) {
    const key = dayKey(n.createdAt);
    const existing = groups.find((g) => g.day === key);
    if (existing) {
      existing.items.push(n);
    } else {
      groups.push({ day: key, label: formatDayLabel(n.createdAt), items: [n] });
    }
  }
  return groups;
}

function NotificationRow({
  n,
  onMarkRead,
  severityLabel,
}: {
  n: NotificationView;
  onMarkRead: (id: string) => void;
  severityLabel: Record<NotificationSeverity, string>;
}) {
  const severity = NOTIFICATION_SEVERITY[n.type];
  return (
    <div
      className={`flex min-h-[56px] items-start gap-4 rounded-[1.2rem] border border-border border-l-4 p-4 transition-colors ${SEVERITY_STYLES[severity]} ${n.isRead ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide ${SEVERITY_BADGE[severity]}`}
          >
            {severityLabel[severity]}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} />
            {formatAge(n.createdAt)}
          </span>
          {n.isRead ? (
            <span className="text-xs text-muted-foreground/60">· lu</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
          {n.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {n.body}
        </p>
      </div>
      {!n.isRead ? (
        <button
          type="button"
          title="Marquer comme lu"
          onClick={() => onMarkRead(n.id)}
          className="mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <CheckCheck size={15} />
        </button>
      ) : null}
    </div>
  );
}

export function NotificationsPageClient() {
  const t = useTranslations("notifications");
  const [showUnread, setShowUnread] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading } = useNotifications({
    limit,
    offset,
    unread: showUnread || undefined,
  });
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();

  const severityLabel: Record<NotificationSeverity, string> = {
    high: t("severity.high"),
    medium: t("severity.medium"),
    low: t("severity.low"),
  };

  const notifications = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupByDay(notifications);

  return (
    <div className="flex flex-col gap-5">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setShowUnread(false);
              setOffset(0);
            }}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${!showUnread ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {t("all")}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUnread(true);
              setOffset(0);
            }}
            className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${showUnread ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {t("unread")}
            {unreadCount > 0 ? (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-destructive text-[0.58rem] font-bold text-destructive-foreground tabular-nums">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onClick={() => markAllRead()}
          disabled={markingAll || unreadCount === 0}
        >
          <CheckCheck size={14} />
          {t("markAllRead")}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[1.2rem]" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
          <span className="inline-flex size-14 items-center justify-center rounded-[1.2rem] border border-border bg-panel-strong">
            <BellOff size={28} className="opacity-40" />
          </span>
          <div className="text-center">
            <p className="font-semibold text-foreground">Tout est à jour</p>
            <p className="mt-1 text-sm">{t("emptyDescription")}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ day, label, items }) => (
            <div key={day} className="flex flex-col gap-2">
              {/* Day separator */}
              <div className="flex items-center gap-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {label}
                </p>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Items */}
              <div className="flex flex-col gap-2">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onMarkRead={(id) => markRead(id)}
                    severityLabel={severityLabel}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {hasPrev || hasMore ? (
        <div className="flex justify-center gap-3">
          {hasPrev ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Précédent
            </Button>
          ) : null}
          {hasMore ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => setOffset(offset + limit)}
            >
              Suivant
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
