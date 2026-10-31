"use client";

import { playerFetch } from "@/lib/api/player-fetch";
import { countedKey, saveQuote, ticketKey } from "./ticket-store";
import type { TicketLeg, TicketQuote, TicketState } from "./ticket-types";

const inFlight = new Map<string, Promise<void>>();

/**
 * Prices the ticket now on the server (POST /ticket/quote): the 1xBet price
 * and fair frequency of each bet, the three figures in decimal, the hero of
 * the day. `verify`: the player opened the sheet on a composition not yet
 * counted today; the server counts it, anonymously (07 § 7). One call in
 * flight per composition, whoever asks (the bar or the sheet).
 */
export function quoteTicket(
  legs: readonly TicketLeg[],
  verify: boolean,
): Promise<void> {
  const key = ticketKey(legs);
  const flight = `${key}|${verify}`;
  const running = inFlight.get(flight);
  if (running) return running;
  const call = playerFetch<TicketQuote>("/ticket/quote", {
    method: "POST",
    body: {
      legs: legs.map(({ fixtureId, market, pick }) => ({
        fixtureId,
        market,
        pick,
      })),
      ...(verify ? { verify: true } : {}),
    },
  })
    .then((quote) => {
      if (!quote) throw new Error("/ticket/quote: empty answer");
      saveQuote(key, quote, { counted: verify });
    })
    .finally(() => inFlight.delete(flight));
  inFlight.set(flight, call);
  return call;
}

/** Not counted yet today: the sheet asks the server to count it. */
export function needsCount(state: TicketState, now: Date): boolean {
  return state.counted !== countedKey(ticketKey(state.legs), now.toISOString());
}
