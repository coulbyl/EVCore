"use client";

import { useState } from "react";
import { markAllNotificationsRead } from "@/domains/notifications/use-unread-count";
import type { FeedKind } from "@/domains/notifications/helpers/notification-feed";

/**
 * « Tout marquer comme lu », within the kind shown (an admin's technical
 * alerts alone): the server marks what the list counts unread and answers
 * the badge's new count; the list is drawn again with it (UnreadDrawn).
 */
export function MarkAllRead({
  kind,
  label,
}: {
  kind: FeedKind;
  label: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void markAllNotificationsRead(kind).finally(() => setPending(false));
      }}
      className="flex min-h-11 items-center rounded-md px-2 text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:text-muted-foreground"
    >
      {label}
    </button>
  );
}
