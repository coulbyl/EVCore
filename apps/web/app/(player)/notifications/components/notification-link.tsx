"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  markedReadLocally,
  refreshUnread,
} from "@/domains/notifications/use-unread-count";

/**
 * A line of the bell's list (09 § 6): touching it marks it read — opening
 * the list marks nothing — and leads where it is about, at once. The badge
 * drops at once and is read again once the read is written; the next
 * screen's server count cannot raise it back (it only seeds an empty bell,
 * use-unread-count.ts). An announcement leads here: the list is drawn
 * again with it read.
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
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Link
      href={href}
      onClick={() => {
        if (!unread) return;
        markedReadLocally();
        void playerFetch(`/notifications/${encodeURIComponent(id)}/read`, {
          method: "PATCH",
          keepalive: true,
        })
          .catch(() => undefined)
          .then(() => refreshUnread())
          .then((changed) => {
            // The list stays on screen: drawn again once it knows the read
            // (a count that moved again already redraws it, PushBridge).
            if (!changed && href === pathname) router.refresh();
          });
      }}
      className="-mx-2 flex min-h-14 items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
