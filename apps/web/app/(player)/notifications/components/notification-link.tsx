"use client";

import Link from "next/link";
import { playerFetch } from "@/lib/api/player-fetch";

/**
 * A line of the bell's list (09 § 6): touching it marks it read — opening
 * the list marks nothing — and leads where it is about. The read is sent
 * with `keepalive`, so it outlives the navigation.
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
        if (unread) {
          void playerFetch(`/notifications/${encodeURIComponent(id)}/read`, {
            method: "PATCH",
            keepalive: true,
          }).catch(() => undefined);
        }
      }}
      className="-mx-2 flex min-h-14 items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
