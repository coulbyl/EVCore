"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { playerFetch } from "@/lib/api/player-fetch";

/** The team answers within hours: a look every minute is plenty. */
const REFRESH_MS = 60_000;

/**
 * Keeps the thread current without a socket (09 § 2): opening it marks
 * everything read (« 1 réponse » on Moi and the bell drop together), and
 * it is read again every minute and when the player comes back to it.
 */
export function ThreadLive({ unread }: { unread: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (unread) {
      playerFetch("/support/read", { method: "POST" }).catch(() => {
        // Read state is a convenience: the thread still shows.
      });
    }
  }, [unread]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
