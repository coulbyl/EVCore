"use client";

import { unstable_rethrow } from "next/navigation";
import { createContext, useContext, useEffect, useOptimistic } from "react";

/**
 * The bell's badge: the unread count the player's layout read on the server
 * (`unread`), the same request as the Notifications list it sits beside. A
 * read, « tout marquer », a push or another tab's read draws the layout
 * again (a server action's `revalidatePath`, `router.refresh`), and the
 * badge with it: no count is kept in the browser.
 *
 * One thing only is the tab's own: the rows being marked read right now
 * (`dropOne`, an optimistic drop inside the read's transition), so the
 * badge falls at the touch; when the transition ends, the redrawn layout's
 * count takes over, or, the read not written, the drop is taken back.
 */
type Bell = {
  /** The badge's count; null when the server could not count. */
  count: number | null;
  /** The layout's count, without the rows being marked. */
  drawn: number | null;
  /** Inside a transition: one row shown unread is being marked. */
  dropOne: () => void;
};

const BellContext = createContext<Bell>({
  count: null,
  drawn: null,
  dropOne: () => undefined,
});

/** Set once in the player's layout, around the band, the rail and the screen. */
export function BellCountProvider({
  unread,
  children,
}: {
  unread: number | null;
  children: React.ReactNode;
}) {
  const [dropped, drop] = useOptimistic(
    0,
    (rows: number, by: number) => rows + by,
  );
  const count = unread === null ? null : Math.max(0, unread - dropped);
  return (
    <BellContext value={{ count, drawn: unread, dropOne: () => drop(1) }}>
      {children}
    </BellContext>
  );
}

export function useBell(): Bell {
  return useContext(BellContext);
}

/**
 * The other tabs open on EVCore: a read written here is told to them, and
 * they draw their layout again (`useBellChanged`). A tab never hears its
 * own messages.
 */
let channel: BroadcastChannel | null | undefined;

function bellChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("evcore-bell");
  }
  return channel;
}

/** A read was written in this tab (a row, « tout marquer », a thread). */
export function announceBellChange(): void {
  bellChannel()?.postMessage("changed");
}

/** Called when another tab wrote a read. */
export function useBellChanged(listener: () => void): void {
  useEffect(() => {
    const current = bellChannel();
    if (!current) return;
    const onMessage = () => listener();
    current.addEventListener("message", onMessage);
    return () => current.removeEventListener("message", onMessage);
  }, [listener]);
}

/**
 * A server action that redirects rejects its promise with the redirect,
 * after the router has already taken it: the read was written and the
 * navigation runs. Caught here, it is not thrown at an error boundary that
 * would remount the screen (or, from the layout, the whole shell).
 */
export function isActionRedirect(error: unknown): boolean {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
}
