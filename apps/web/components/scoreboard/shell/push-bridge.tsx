"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDocumentVisible } from "@/components/scoreboard/states/use-document-visible";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  announceBellChange,
  readNotification,
  useBell,
  useBellChanged,
} from "@/domains/notifications/bell-count";

/** The query parameter a tapped push adds: the bell's row it announced. */
const NOTIFICATION_PARAM = "n";

/** Coming back to the tab reads the count again, at most this often. */
const RETURN_REFRESH_MS = 15_000;

/**
 * Between the service worker, the bell and the screens (no markup). The
 * bell's count is the layout's: each of these draws it again.
 *
 * - a tapped push opens its page with `?n=<id>`: that notification is
 *   marked read (a server action, the layout redrawn), the parameter leaves
 *   the address;
 * - a push arriving while the app is open, or a read written in another
 *   tab: the layout is drawn again — at once when the tab shows, else on
 *   its return;
 * - coming back to the tab reads the count (a notification written
 *   meanwhile, for a player who never granted the push) and draws the
 *   layout again when it moved;
 * - the installed app's icon shows the same count (App Badging API, where
 *   the browser has it).
 */
export function PushBridge() {
  const router = useRouter();
  const { count } = useBell();
  const visible = useDocumentVisible();
  const [, startTransition] = useTransition();
  // When the count was last read for a return; whether the tab was hidden
  // since the screen showed (a first showing reads nothing: the server has
  // just counted); a redraw asked while hidden.
  const last = useRef(0);
  const wasHidden = useRef(false);
  const stale = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get(NOTIFICATION_PARAM);
    if (!id) return;
    url.searchParams.delete(NOTIFICATION_PARAM);
    const clean = `${url.pathname}${url.search}${url.hash}`;
    startTransition(async () => {
      // One action: the read, then the clean address in place of this one,
      // the layout drawn again with it. Not written (the row may be gone),
      // the parameter leaves all the same.
      const written = await readNotification(id, clean, true);
      if (written) announceBellChange();
      else router.replace(clean, { scroll: false });
    });
  }, [router]);

  const redraw = useCallback(() => {
    if (document.visibilityState === "visible") router.refresh();
    else stale.current = true;
  }, [router]);

  useBellChanged(redraw);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "push") redraw();
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [redraw]);

  useEffect(() => {
    if (!visible) {
      wasHidden.current = true;
      return;
    }
    if (!wasHidden.current) return;
    wasHidden.current = false;
    if (stale.current) {
      stale.current = false;
      last.current = Date.now();
      router.refresh();
      return;
    }
    // The first return reads at once: the screen may have been drawn long ago.
    if (Date.now() - last.current < RETURN_REFRESH_MS) return;
    last.current = Date.now();
    void playerFetch<{ count: number }>("/notifications/unread-count", {
      method: "GET",
    }).then(
      (answer) => {
        if (typeof answer?.count === "number" && answer.count !== count)
          router.refresh();
      },
      () => undefined,
    );
  }, [visible, count, router]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const shown = count ?? 0;
    const update = shown > 0 ? nav.setAppBadge?.(shown) : nav.clearAppBadge?.();
    // Refused outside an installed app on some browsers: nothing to show.
    void update?.catch(() => undefined);
  }, [count]);

  return null;
}
