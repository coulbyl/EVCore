"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/** The query parameter a tapped push adds: the bell's row it announced. */
const NOTIFICATION_PARAM = "n";

/**
 * Between the service worker and the screens (no markup):
 *
 * - a tapped push opens its page with `?n=<id>`: that notification is
 *   marked read, the parameter leaves the address, the screen refreshes
 *   and the bell's badge with it;
 * - a push arriving while the app is open refreshes the screen, so the
 *   badge counts it without a navigation;
 * - the installed app's icon shows the same count (App Badging API, where
 *   the browser has it).
 */
export function PushBridge({ unread }: { unread: number }) {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get(NOTIFICATION_PARAM);
    if (!id) return;
    url.searchParams.delete(NOTIFICATION_PARAM);
    void playerFetch(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    })
      .catch(() => undefined)
      .finally(() => {
        router.replace(`${url.pathname}${url.search}${url.hash}`, {
          scroll: false,
        });
        router.refresh();
      });
  }, [router]);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "push") router.refresh();
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const update =
      unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.();
    // Refused outside an installed app on some browsers: nothing to show.
    void update?.catch(() => undefined);
  }, [unread]);

  return null;
}
