"use client";

import { lazy, Suspense, useSyncExternalStore } from "react";
import type { DisplayLocale } from "@/helpers/scoreboard-format";
import { subscribeTicketSignal, ticketFixtureIds } from "./ticket-signal";

// Loaded once the ticket holds a bet: most visits never fill one. React's
// own lazy, not next/dynamic, whose loader weighed as much as the bar (C7).
const TicketBar = lazy(() => import("./ticket-bar"));

const NONE: ReadonlySet<string> = new Set();
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * « Mon ticket » above the tabs, when the device's ticket holds a bet.
 *
 * It also shows the ✓ of the Matchs rows whose match is in the ticket
 * (maquette MatchsTicket): the rows render it hidden on the server, a style
 * written here shows the right ones. No script touches the rows, so no
 * hydration mismatch, and no client component per row (C7). Only ids shaped
 * as ids reach the style.
 */
export function TicketDock(props: { locale: DisplayLocale; paused: boolean }) {
  const ids = useSyncExternalStore(
    subscribeTicketSignal,
    ticketFixtureIds,
    () => NONE,
  );
  if (ids.size === 0) return null;
  const marks = [...ids]
    .filter((id) => UUID.test(id))
    .map((id) => `span[data-ticket-mark="${id}"]{display:inline-flex}`)
    .join("");
  return (
    <>
      <style>{marks}</style>
      <Suspense fallback={null}>
        <TicketBar {...props} />
      </Suspense>
    </>
  );
}
