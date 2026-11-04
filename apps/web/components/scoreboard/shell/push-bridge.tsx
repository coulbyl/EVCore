"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import type { UnreadReading } from "@/domains/notifications/helpers/notification-feed";
import {
  onUnreadChangedElsewhere,
  refreshUnread,
  useUnreadCount,
} from "@/domains/notifications/use-unread-count";

/** The query parameter a tapped push adds: the bell's row it announced. */
const NOTIFICATION_PARAM = "n";

/** Coming back to the tab reads the count again, at most this often. */
const RETURN_REFRESH_MS = 15_000;

/**
 * Between the service worker, the bell and the screens (no markup):
 *
 * - a tapped push opens its page with `?n=<id>`: that notification is
 *   marked read, the parameter leaves the address, the badge and the
 *   screen refresh;
 * - a push arriving while the app is open reads the count again and
 *   refreshes the screen, so the badge and the list count it at once;
 * - coming back to the tab reads the count again (a notification written
 *   meanwhile, for a player who never granted the push, or read in another
 *   tab); on Notifications, a changed count redraws the list with it;
 * - the installed app's icon shows the same count (App Badging API, where
 *   the browser has it).
 */
export function PushBridge({ unread }: { unread: UnreadReading | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const count = useUnreadCount(unread);
  const onNotifications = useRef(false);
  useEffect(() => {
    onNotifications.current = pathname === "/notifications";
  }, [pathname]);

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
        void refreshUnread();
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
      if (event.data?.type !== "push") return;
      void refreshUnread();
      router.refresh();
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    // The first return reads at once: the screen may have been drawn long ago.
    let last = 0;
    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < RETURN_REFRESH_MS) return;
      last = Date.now();
      void refreshUnread().then((changed) => {
        if (changed && onNotifications.current) router.refresh();
      });
    };
    document.addEventListener("visibilitychange", onReturn);
    const stop = onUnreadChangedElsewhere(() => {
      if (onNotifications.current) router.refresh();
    });
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      stop();
    };
  }, [router]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const update = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
    // Refused outside an installed app on some browsers: nothing to show.
    void update?.catch(() => undefined);
  }, [count]);

  return null;
}
