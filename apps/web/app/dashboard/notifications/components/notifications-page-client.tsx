"use client";

import { useState } from "react";
import { Bell, CheckCheck, Clock } from "lucide-react";
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
      className={`flex items-start gap-4 rounded-[1.2rem] border border-border border-l-4 p-4 transition-colors ${SEVERITY_STYLES[severity]} ${n.isRead ? "opacity-60" : ""}`}
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
          {n.isRead && (
            <span className="text-xs text-muted-foreground/60">· lu</span>
          )}
        </div>
        <p className="mt-1.5 font-semibold leading-snug text-foreground">
          {n.title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {n.body}
        </p>
      </div>
      {!n.isRead && (
        <button
          type="button"
          title="Marquer comme lu"
          onClick={() => onMarkRead(n.id)}
          className="mt-1 flex-shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <CheckCheck size={15} />
        </button>
      )}
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

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowUnread(false);
              setOffset(0);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${!showUnread ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {t("all")}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUnread(true);
              setOffset(0);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${showUnread ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {t("unread")}
            {unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[0.58rem] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead()}
          disabled={markingAll || unreadCount === 0}
          className="gap-2"
        >
          <CheckCheck size={14} />
          {t("markAllRead")}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[1.2rem]" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Bell size={36} className="opacity-30" />
          <p className="font-semibold">{t("empty")}</p>
          <p className="text-sm">{t("emptyDescription")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onMarkRead={(id) => markRead(id)}
              severityLabel={severityLabel}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex justify-center gap-3">
          {hasPrev && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Précédent
            </Button>
          )}
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset(offset + limit)}
            >
              Suivant
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
