"use client";

import { useSyncExternalStore } from "react";
import {
  serverTicketSnapshot,
  subscribeTicket,
  ticketSnapshot,
} from "./ticket-store";
import type { TicketState } from "./ticket-types";

/** « Mon ticket » as kept on the device; empty during the server render. */
export function useTicket(): TicketState {
  return useSyncExternalStore(
    subscribeTicket,
    ticketSnapshot,
    serverTicketSnapshot,
  );
}
