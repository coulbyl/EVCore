"use client";

import { useEffect, useSyncExternalStore } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { newerReading, type UnreadReading } from "./helpers/notification-feed";

/**
 * The bell's badge, one count for the whole tab (the band on the phone, the
 * left rail and the installed app's icon on a computer), and for every tab
 * open on EVCore (BroadcastChannel). The server's count is the truth:
 * a screen draws it (`seed`), and the tab reads it again after a read, a
 * push, or coming back to the tab (`refreshUnread`). The left rail lives in
 * the layout, which a navigation never draws again: without this store it
 * kept the count of the first page shown.
 */
let reading: UnreadReading | null = null;
const listeners = new Set<() => void>();
const elsewhereListeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

function apply(next: UnreadReading): boolean {
  const before = reading;
  reading = newerReading(reading, next);
  if (reading === before) return false;
  listeners.forEach((listener) => listener());
  return before?.count !== reading.count;
}

function bellChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel("evcore-bell");
  channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
    const data = event.data as Partial<UnreadReading> | null;
    if (typeof data?.count !== "number" || typeof data.asOf !== "number")
      return;
    if (apply({ count: data.count, asOf: data.asOf }))
      elsewhereListeners.forEach((listener) => listener());
  });
  return channel;
}

/** A row was just marked read: the badge drops before the server answers. */
export function markedReadLocally(): void {
  if (reading === null || reading.count === 0) return;
  apply({ count: reading.count - 1, asOf: Date.now() });
}

/**
 * Reads the count again and tells the other tabs. True when it changed.
 * A failed read changes nothing: the badge keeps what it showed.
 */
export async function refreshUnread(): Promise<boolean> {
  const asOf = Date.now();
  try {
    const answer = await playerFetch<{ count: number }>(
      "/notifications/unread-count",
      { method: "GET" },
    );
    if (typeof answer?.count !== "number") return false;
    const next = { count: answer.count, asOf };
    const changed = apply(next);
    bellChannel()?.postMessage(next);
    return changed;
  } catch {
    return false;
  }
}

/** Called when another tab changed the count (to redraw a list). */
export function onUnreadChangedElsewhere(listener: () => void): () => void {
  bellChannel();
  elsewhereListeners.add(listener);
  return () => elsewhereListeners.delete(listener);
}

function subscribe(listener: () => void): () => void {
  bellChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The badge's count: the server's reading of this screen until the tab has
 * a newer one. A screen whose server read failed (null) seeds nothing.
 */
export function useUnreadCount(server: UnreadReading | null): number {
  const count = server?.count;
  const asOf = server?.asOf;
  // Stamped on this browser's clock when it arrives: the server's own
  // Date.now() is another clock, and a browser running ahead would keep a
  // stale local reading over every fresher server count.
  useEffect(() => {
    if (count !== undefined && asOf !== undefined) {
      apply({ count, asOf: Date.now() });
    }
  }, [count, asOf]);
  const live = useSyncExternalStore(
    subscribe,
    () => reading,
    () => null,
  );
  return (live ?? server)?.count ?? 0;
}
