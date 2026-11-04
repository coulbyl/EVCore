"use client";

import Link from "next/link";
import { markNotificationRead } from "@/domains/notifications/use-unread-count";

/**
 * A line of the bell's list (09 § 6): touching it marks it read — opening
 * the list marks nothing — and leads where it is about, at once. The badge
 * drops at once; the server's answer confirms it, and an announcement,
 * which leads here, redraws the list with it read (UnreadDrawn).
 */
export function NotificationLink({
  id,
  href,
  unread,
  children,
}: {
  id: string;
  href: string;
  unread: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (unread)
          void markNotificationRead(id, { optimistic: true, keepalive: true });
      }}
      className="-mx-2 flex min-h-14 items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
