"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { isPlainClick } from "@/components/scoreboard/sheet/sheet-constants";
import { markNotificationRead } from "@/domains/notifications/actions/notification-actions";
import {
  announceBellChange,
  isActionRedirect,
  useBell,
} from "@/domains/notifications/bell-count";

/**
 * A line of the bell's list (09 § 6): touching an unread one marks it read
 * — opening the list marks nothing — and leads where it is about (`href`;
 * null: an announcement, shown here in full). One server action marks it,
 * draws the layout again (the badge and the list, the same set) and goes
 * to `href`; the badge drops at the touch. Not written: the row stays
 * unread and the touch still leads on. A read row is a plain link.
 */
export function NotificationLink({
  id,
  href,
  unread,
  children,
}: {
  id: string;
  href: string | null;
  unread: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { dropOne } = useBell();
  const [, startTransition] = useTransition();
  return (
    <Link
      href={href ?? "/notifications"}
      onClick={(event) => {
        if (!unread) return;
        // A new tab or window: the browser navigates, the read still goes.
        if (!isPlainClick(event)) {
          startTransition(async () => {
            dropOne();
            await markNotificationRead(id, null).catch(() => undefined);
            announceBellChange();
          });
          return;
        }
        event.preventDefault();
        startTransition(async () => {
          dropOne();
          let written = false;
          try {
            written = (await markNotificationRead(id, href)).written;
          } catch (error) {
            // Redirected to `href`: written, and the router goes there.
            // Otherwise offline, or a build the server no longer has.
            written = isActionRedirect(error);
          }
          announceBellChange();
          if (!written && href) router.push(href);
        });
      }}
      className="-mx-2 flex min-h-14 items-start gap-3 rounded-md px-2 py-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
