"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import {
  NOTIFICATION_BODY_IS_HTML,
  NOTIFICATION_SEVERITY,
  type NotificationView,
} from "@/domains/notification/types/notification";
import {
  ageOf,
  notificationHref,
  plainTextPreview,
} from "./notification-constants";

/** Ce qu'un joueur reçoit : chacun a son libellé et son lien. */
const PLAYER_TYPES = [
  "ANNOUNCEMENT_PUBLISHED",
  "SUPPORT_MESSAGE",
  "SLIPS_SETTLED_DIGEST",
  "MORNING_BRIEF",
  "WEEKLY_STATEMENT",
] as const;

const SEVERITY_BADGE = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-warning/15 text-warning",
  low: "bg-secondary text-muted-foreground",
} as const;

/**
 * Une notification : sa nature (annonce, réponse de l'équipe), son âge, son
 * titre, un aperçu et un lien direct. Une notification lue reste lisible
 * (plus d'opacité à 60 %, contraste de 1,7 à 2,5:1) : seul le point et la
 * graisse du titre distinguent ce qui n'est pas lu. La gravité ne s'affiche
 * qu'aux admins, seuls à recevoir des alertes d'ingénierie.
 */
export function NotificationRow({
  n,
  isAdmin,
  onMarkRead,
}: {
  n: NotificationView;
  isAdmin: boolean;
  onMarkRead: (id: string) => void;
}) {
  const t = useTranslations("notifications");
  const href = notificationHref(n);
  const age = ageOf(n.createdAt);
  const severity = NOTIFICATION_SEVERITY[n.type] ?? "low";
  const preview = NOTIFICATION_BODY_IS_HTML.has(n.type)
    ? plainTextPreview(n.body)
    : n.body;
  const playerType = PLAYER_TYPES.find((type) => type === n.type) ?? null;
  const kind = playerType ? t(`kind.${playerType}`) : null;

  return (
    <li
      data-testid="notification-row"
      className="flex items-start gap-3 rounded-[1.2rem] border border-border bg-panel p-4"
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          n.isRead ? "bg-transparent" : "bg-accent",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {isAdmin && severity === "high" ? (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${SEVERITY_BADGE[severity]}`}
            >
              {t("severity.high")}
            </span>
          ) : null}
          {kind ? <span className="font-medium">{kind}</span> : null}
          <span>
            {age.unit === "justNow"
              ? t("age.justNow")
              : t(`age.${age.unit}`, { count: age.count })}
          </span>
          {n.isRead ? <span>· {t("read")}</span> : null}
        </p>
        <p
          className={cn(
            "mt-1 text-sm leading-snug text-foreground",
            n.isRead ? "font-medium" : "font-semibold",
          )}
        >
          {n.title}
        </p>
        {preview ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {preview}
          </p>
        ) : null}
        {href ? (
          <Link
            href={href}
            onClick={() => {
              if (!n.isRead) onMarkRead(n.id);
            }}
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            {t(`open.${playerType ?? "ANNOUNCEMENT_PUBLISHED"}`)}
            <ArrowRight size={14} />
          </Link>
        ) : null}
      </div>
      {!n.isRead ? (
        <button
          type="button"
          aria-label={t("markRead")}
          title={t("markRead")}
          onClick={() => onMarkRead(n.id)}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Check size={16} />
        </button>
      ) : null}
    </li>
  );
}
