"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@evcore/ui/cn";
import { useUnreadCount } from "@/domains/notifications/use-unread-count";

/**
 * La cloche et son badge (09 § 6). Le compte est celui de l'onglet
 * (`useUnreadCount`) : il baisse dès qu'une ligne est lue et monte à
 * l'arrivée d'une notification, sans attendre que l'écran soit redessiné.
 */
export function BellLink({
  unread,
  labels,
  className,
}: {
  unread: number | null;
  labels: { notifications: string; unread: string };
  className?: string;
}) {
  const count = useUnreadCount(unread);
  return (
    <Link
      href="/notifications"
      aria-label={
        count > 0
          ? `${labels.notifications}, ${labels.unread.replace("{count}", String(count))}`
          : labels.notifications
      }
      className={cn(className, "relative")}
    >
      <Bell aria-hidden className="size-5" strokeWidth={1.8} />
      {count > 0 ? (
        <span
          aria-hidden
          className="score absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-led-on px-1 text-legal font-bold text-band"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
