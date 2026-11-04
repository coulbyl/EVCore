"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDocumentVisible } from "@/components/scoreboard/states/use-document-visible";
import {
  markNotificationRead,
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
 *   marked read, the parameter leaves the address;
 * - a push arriving while the app is open reads the count again;
 * - coming back to the tab reads the count again (a notification written
 *   meanwhile, for a player who never granted the push);
 * - the installed app's icon shows the same count (App Badging API, where
 *   the browser has it).
 *
 * The Notifications list redraws itself when the count moves (UnreadDrawn).
 */
export function PushBridge({ unread }: { unread: number | null }) {
  const router = useRouter();
  const count = useUnreadCount(unread);
  const visible = useDocumentVisible();
  // When the count was last read for a push or a return; and whether the
  // tab was hidden since the screen showed (a first showing reads nothing:
  // the server has just counted).
  const last = useRef(0);
  const wasHidden = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get(NOTIFICATION_PARAM);
    if (!id) return;
    url.searchParams.delete(NOTIFICATION_PARAM);
    // Not optimistic: the row may have been read already.
    void markNotificationRead(id, { optimistic: false }).finally(() => {
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
      if (event.data?.type !== "push") return;
      last.current = Date.now();
      void refreshUnread();
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!visible) {
      wasHidden.current = true;
      return;
    }
    if (!wasHidden.current) return;
    wasHidden.current = false;
    // The first return reads at once: the screen may have been drawn long ago.
    if (Date.now() - last.current < RETURN_REFRESH_MS) return;
    last.current = Date.now();
    void refreshUnread();
  }, [visible]);

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
