"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import { refreshUnread } from "@/domains/notifications/use-unread-count";
import type { FeedKind } from "@/domains/notifications/helpers/notification-feed";

/**
 * « Tout marquer comme lu », within the kind shown (an admin's technical
 * alerts alone): the server marks what the list counts unread, then the
 * badge and the list are read again together.
 */
export function MarkAllRead({
  kind,
  label,
}: {
  kind: FeedKind;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const query = kind === "all" ? "" : `?category=${kind}`;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        playerFetch(`/notifications/read-all${query}`, { method: "POST" })
          .then(() => refreshUnread())
          .catch(() => undefined)
          .finally(() => {
            setPending(false);
            router.refresh();
          });
      }}
      className="flex min-h-11 items-center rounded-md px-2 text-body font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:text-muted-foreground"
    >
      {label}
    </button>
  );
}
