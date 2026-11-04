"use client";

import { useEffect, useSyncExternalStore } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import { newerReading, type UnreadReading } from "./helpers/notification-feed";

/**
 * The bell's badge, one count for the whole tab (the band on the phone, the
 * left rail and the installed app's icon on a computer), and for every tab
 * open on EVCore (BroadcastChannel). The first screen's server count only
 * seeds it (`useUnreadCount`); from then on the tab's own readings decide —
 * after a read, a push, or coming back to the tab (`refreshUnread`) — all
 * stamped on this browser's clock, so the newest always wins. A screen
 * drawn later (or restored from the router's cache) never brings back a
 * count already read. The left rail lives in the layout, which a
 * navigation never draws again: without this store it kept the count of
 * the first page shown.
 */
let reading: UnreadReading | null = null;
/** The last count this tab sent or heard on the channel. */
let shared: number | null = null;
/** Whether the count shown is this tab's own drop (`markedReadLocally`). */
let markedHere = false;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

/** True when the count shown changed. */
function apply(next: UnreadReading, local = false): boolean {
  const before = reading;
  reading = newerReading(reading, next);
  if (reading === before) return false;
  markedHere = local;
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
    shared = data.count;
    apply({ count: data.count, asOf: data.asOf });
  });
  return channel;
}

/** A row was just marked read: the badge drops before the server answers. */
export function markedReadLocally(): void {
  if (reading === null || reading.count === 0) return;
  apply({ count: reading.count - 1, asOf: Date.now() }, true);
}

/**
 * Whether the count shown is a row this tab just touched: the screen that
 * touched it redraws itself (NotificationLink), nothing else needs to.
 */
export function shownCountMarkedHere(): boolean {
  return markedHere;
}

/**
 * Reads the count again and, when it is news to them, tells the other tabs.
 * True when the count shown changed. A failed read changes nothing: the
 * badge keeps what it showed.
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
    if (answer.count !== shared) {
      shared = answer.count;
      bellChannel()?.postMessage(next);
    }
    return changed;
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  bellChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The badge's count. The server's count of the screen (null when its read
 * failed) seeds the tab while it has no reading of its own, and is ignored
 * after: it was read on another clock, maybe before a read this tab knows.
 */
export function useUnreadCount(server: number | null): number {
  useEffect(() => {
    if (reading === null && server !== null) {
      apply({ count: server, asOf: Date.now() });
    }
  }, [server]);
  const live = useSyncExternalStore(
    subscribe,
    () => reading,
    () => null,
  );
  return live?.count ?? server ?? 0;
}
