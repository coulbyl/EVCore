"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  markedReadLocally,
  refreshUnread,
} from "@/domains/notifications/use-unread-count";

/** How long a touched row waits for its read before leading on anyway. */
const READ_WAIT_MS = 1_500;

/**
 * A line of the bell's list (09 § 6): touching it marks it read — opening
 * the list marks nothing — and leads where it is about. The badge drops at
 * once; the screen it leads to is drawn once the read is written, so the
 * count it shows already knows it (sent in the same tick, the read lost the
 * race to the next screen's count, and the badge stayed up). An
 * announcement leads here: the list is drawn again with it read.
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
      onClick={(event) => {
        if (!unread) return;
        // A new tab or window: the read goes, the navigation is the browser's.
        const plain =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;
        const read = playerFetch(
          `/notifications/${encodeURIComponent(id)}/read`,
          { method: "PATCH", keepalive: true },
        ).catch(() => undefined);
        markedReadLocally();
        if (!plain) {
          void read.then(refreshUnread);
          return;
        }
        event.preventDefault();
        // A read that hangs never holds the player on the list.
        const settled = Promise.race([
          read,
          new Promise((resolve) => window.setTimeout(resolve, READ_WAIT_MS)),
        ]);
        void settled.then(() => {
          void refreshUnread();
          if (href === pathname) router.refresh();
          else router.push(href);
        });
      }}
      className="-mx-2 flex min-h-14 items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
