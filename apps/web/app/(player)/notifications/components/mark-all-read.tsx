"use client";

import { useTransition } from "react";
import { markAllNotificationsRead } from "@/domains/notifications/actions/notification-actions";
import { announceBellChange } from "@/domains/notifications/bell-count";
import type { FeedKind } from "@/domains/notifications/helpers/notification-feed";

/**
 * « Tout marquer comme lu », within the kind shown (an admin's technical
 * alerts alone): a server action marks what the list counts unread and
 * draws the layout again, badge and list together.
 */
export function MarkAllRead({
  kind,
  label,
}: {
  kind: FeedKind;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const { written } = await markAllNotificationsRead(kind).catch(
            () => ({
              written: false,
            }),
          );
          if (written) announceBellChange();
        });
      }}
      className="flex min-h-11 items-center rounded-md px-2 text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:text-muted-foreground"
    >
      {label}
    </button>
  );
}
