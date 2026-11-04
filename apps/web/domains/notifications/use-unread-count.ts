"use client";

import { useEffect, useSyncExternalStore } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  newerReading,
  type FeedKind,
  type UnreadReading,
} from "./helpers/notification-feed";

/**
 * The bell's badge, one count for the whole tab (the band on the phone, the
 * left rail and the installed app's icon on a computer), and for every tab
 * open on EVCore (BroadcastChannel). The left rail lives in the layout,
 * which a navigation never draws again: without this store it kept the
 * count of the first page shown.
 *
 * Two parts: the **confirmed** count, the server's last answer (a read
 * written, a push, a return to the tab, the Notifications list drawn), all
 * stamped on this browser's clock so the newest always wins; and the rows
 * this tab is marking read right now (`pending`), dropped from the badge
 * before the server answers. The badge shows confirmed − pending.
 */
type State = { confirmed: UnreadReading | null; pending: number };

let state: State = { confirmed: null, pending: 0 };
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;
/** The Notifications renders whose count is already in the store. */
const drawnRenders = new Set<string>();

function set(next: State): void {
  if (next.pending === state.pending && next.confirmed === state.confirmed)
    return;
  state = next;
  listeners.forEach((listener) => listener());
}

/** A server answer, with the pending rows it settles (`settled`). */
function confirm(next: UnreadReading, settled = 0): void {
  set({
    confirmed: newerReading(state.confirmed, next),
    pending: Math.max(0, state.pending - settled),
  });
}

/** A server answer this tab read: kept, and told to the other tabs. */
function confirmAndShare(next: UnreadReading, settled = 0): void {
  confirm(next, settled);
  bellChannel()?.postMessage(next);
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
    // Idempotent: a reading already known, or older, changes nothing.
    confirm({ count: data.count, asOf: data.asOf });
  });
  return channel;
}

function shown(): number | null {
  if (state.confirmed === null) return null;
  return Math.max(0, state.confirmed.count - state.pending);
}

/** The badge's count once a read is written (both reads answer it). */
type ReadAnswer = { unread?: unknown } | null | undefined;

function unreadOf(answer: ReadAnswer): number | null {
  return typeof answer?.unread === "number" ? answer.unread : null;
}

/**
 * Marks a row read. `optimistic`: the row was shown unread, the badge drops
 * at once; the server's answer (the new count) then replaces the drop. A
 * failed write takes the drop back: the row is still unread.
 */
export async function markNotificationRead(
  id: string,
  options: { optimistic: boolean; keepalive?: boolean },
): Promise<void> {
  const dropped = options.optimistic && (shown() ?? 0) > 0 ? 1 : 0;
  if (dropped) set({ ...state, pending: state.pending + dropped });
  const unread = await playerFetch<ReadAnswer>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: "PATCH", keepalive: options.keepalive },
  ).then(unreadOf, () => null);
  if (unread === null) {
    // Not written: the row is still unread, the drop is taken back.
    set({ ...state, pending: Math.max(0, state.pending - dropped) });
    return;
  }
  // Stamped on arrival: the count was read after the write.
  confirmAndShare({ count: unread, asOf: Date.now() }, dropped);
}

/** « Tout marquer comme lu » within a kind; the badge takes the answer. */
export async function markAllNotificationsRead(kind: FeedKind): Promise<void> {
  const query = kind === "all" ? "" : `?category=${kind}`;
  const unread = await playerFetch<ReadAnswer>(
    `/notifications/read-all${query}`,
    { method: "POST" },
  ).then(unreadOf, () => null);
  // Nothing marked: the list and the badge stay as they are.
  if (unread !== null) confirmAndShare({ count: unread, asOf: Date.now() });
}

/**
 * Reads the count again (a push, a return to the tab, a thread read) and
 * tells the other tabs. A failed read changes nothing.
 */
export async function refreshUnread(): Promise<void> {
  const asOf = Date.now();
  try {
    const answer = await playerFetch<{ count: number }>(
      "/notifications/unread-count",
      { method: "GET" },
    );
    if (typeof answer?.count === "number")
      confirmAndShare({ count: answer.count, asOf });
  } catch {
    // The badge keeps what it showed.
  }
}

/**
 * The Notifications list was drawn with this count, read by the server for
 * that render (`render`): fresh, it becomes the confirmed count. A render
 * restored from the router's cache is not fresh, and never brings back a
 * count already read.
 */
export function confirmDrawnCount(count: number, render: string): void {
  if (drawnRenders.has(render)) return;
  drawnRenders.add(render);
  confirm({ count, asOf: Date.now() });
}

/** The confirmed count right now (null before any reading). */
export function confirmedUnread(): number | null {
  return state.confirmed?.count ?? null;
}

function subscribe(listener: () => void): () => void {
  bellChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The confirmed count, re-rendering when it changes. */
export function useConfirmedUnread(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => state.confirmed?.count ?? null,
    () => null,
  );
}

/**
 * The badge's count. The server's count of the screen (null when its read
 * failed) seeds the tab while it has no reading of its own, and is ignored
 * after: it was read on another clock, maybe before a read this tab knows.
 */
export function useUnreadCount(server: number | null): number {
  useEffect(() => {
    if (state.confirmed === null && server !== null) {
      confirm({ count: server, asOf: Date.now() });
    }
  }, [server]);
  const live = useSyncExternalStore(subscribe, shown, () => null);
  return live ?? server ?? 0;
}
