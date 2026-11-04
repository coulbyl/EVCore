"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  refreshUnread,
  shownCountMarkedHere,
  useUnreadCount,
} from "@/domains/notifications/use-unread-count";

/** The query parameter a tapped push adds: the bell's row it announced. */
const NOTIFICATION_PARAM = "n";

/** Coming back to the tab reads the count again, at most this often. */
const RETURN_REFRESH_MS = 15_000;

function onVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

/**
 * Between the service worker, the bell and the screens (no markup):
 *
 * - a tapped push opens its page with `?n=<id>`: that notification is
 *   marked read, the parameter leaves the address, the badge reads again;
 * - a push arriving while the app is open reads the count again;
 * - coming back to the tab reads the count again (a notification written
 *   meanwhile, for a player who never granted the push);
 * - on Notifications, a count changed elsewhere than its own rows (a push,
 *   another tab, a return) redraws the list with it, once the tab is shown;
 * - the installed app's icon shows the same count (App Badging API, where
 *   the browser has it).
 */
export function PushBridge({ unread }: { unread: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const count = useUnreadCount(unread);
  const visible = useSyncExternalStore(
    onVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );

  // The count the list on screen was drawn with. A row touched here leads
  // away, or redraws the list itself once its read is written.
  const drawn = useRef(count);
  // Opening Notifications reads the count again: its chip is drawn from the
  // server, and the badge must count the same set (a notification written
  // since, for a player who never granted the push).
  useEffect(() => {
    if (pathname === "/notifications") void refreshUnread();
  }, [pathname]);
  useEffect(() => {
    if (pathname !== "/notifications" || shownCountMarkedHere()) {
      drawn.current = count;
      return;
    }
    if (!visible || drawn.current === count) return;
    drawn.current = count;
    router.refresh();
  }, [count, pathname, visible, router]);

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
        // A new address: the screen is drawn again, the read with it.
        router.replace(`${url.pathname}${url.search}${url.hash}`, {
          scroll: false,
        });
      });
  }, [router]);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "push") void refreshUnread();
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    // The first return reads at once: the screen may have been drawn long ago.
    let last = 0;
    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < RETURN_REFRESH_MS) return;
      last = Date.now();
      void refreshUnread();
    };
    return onVisibility(onReturn);
  }, []);

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
