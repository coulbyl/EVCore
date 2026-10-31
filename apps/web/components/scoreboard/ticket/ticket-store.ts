import {
  readTicketRaw,
  subscribeTicketSignal,
  TICKET_EVENT,
  TICKET_KEY,
} from "./ticket-signal";
import type { TicketLeg, TicketQuote, TicketState } from "./ticket-types";

/**
 * « Mon ticket » on the device (07 § 7): never on the server, which only
 * prices it. One bet per match, 15 at most (07 § 4). Every screen that
 * reads it (the bar, the sheet, the [+] of a match) subscribes here, and a
 * change in another tab arrives through the `storage` event.
 */
export const TICKET_MAX_LEGS = 15;
/** Beyond this move since the last quote, « cote mise à jour » (07 § 6). */
export const ODDS_MOVE_SHOWN = 0.05;

const EMPTY: TicketState = {
  legs: [],
  quote: null,
  counted: null,
  checked: null,
};

const DAY_MS = 86_400_000;

/**
 * The day of a ticket's last match when that day is over (07 § 6: « le
 * lendemain »), YYYY-MM-DD in UTC (Abidjan time); null otherwise. Judged on
 * the matches, not on when it was made: a ticket built at 23:00 for
 * tomorrow's matches is not yesterday's in the morning.
 */
export function pastTicketDay(
  legs: readonly TicketLeg[],
  now: Date = new Date(),
): string | null {
  if (legs.length === 0) return null;
  const last = legs.reduce((latest, leg) =>
    leg.kickoffAt > latest.kickoffAt ? leg : latest,
  ).kickoffAt;
  const lastDay = last.slice(0, 10);
  const today = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return lastDay < today ? lastDay : null;
}

let cache: { raw: string | null; state: TicketState } | null = null;

function read(): TicketState {
  // Storage blocked (private window): null, an empty ticket.
  const raw = readTicketRaw();
  if (cache && cache.raw === raw) return cache.state;
  let state = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && "legs" in parsed) {
      state = { ...EMPTY, ...(parsed as TicketState) };
    }
  } catch {
    state = EMPTY;
  }
  cache = { raw, state };
  return state;
}

function write(state: TicketState): void {
  const raw = JSON.stringify(state);
  try {
    window.localStorage.setItem(TICKET_KEY, raw);
  } catch {
    // Not kept, but the screen still follows the change.
  }
  cache = { raw, state };
  window.dispatchEvent(new Event(TICKET_EVENT));
}

export function subscribeTicket(listener: () => void): () => void {
  return subscribeTicketSignal(listener);
}

export function ticketSnapshot(): TicketState {
  return read();
}

export function serverTicketSnapshot(): TicketState {
  return EMPTY;
}

/** The composition a quote prices: the bets, in a stable order. */
export function ticketKey(legs: readonly TicketLeg[]): string {
  return legs
    .map((leg) => `${leg.fixtureId}|${leg.market}|${leg.pick}`)
    .sort()
    .join(",");
}

export type AddResult = "added" | "replaced" | "full";

/**
 * Adds a bet. A second bet on a match already in the ticket replaces the
 * first (07 § 4, « Un seul pari par match »); a 16th is refused.
 */
export function addToTicket(leg: TicketLeg): AddResult {
  const current = read();
  // A bet on a ticket of yesterday starts today's: the old one is over.
  const { legs, ...rest } = pastTicketDay(current.legs) ? EMPTY : current;
  const same = legs.findIndex((l) => l.fixtureId === leg.fixtureId);
  if (same >= 0) {
    const next = [...legs];
    next[same] = leg;
    write({ ...rest, legs: next });
    return "replaced";
  }
  if (legs.length >= TICKET_MAX_LEGS) return "full";
  write({ ...rest, legs: [...legs, leg] });
  return "added";
}

export function removeFromTicket(fixtureId: string): void {
  const state = read();
  write({
    ...state,
    legs: state.legs.filter((leg) => leg.fixtureId !== fixtureId),
  });
}

export function clearTicket(): void {
  write(EMPTY);
}

/**
 * Keeps a quote and brings each bet to its price now, flagging those that
 * moved by more than ODDS_MOVE_SHOWN since the price kept.
 */
export function saveQuote(
  key: string,
  quote: TicketQuote,
  opts: { counted: boolean },
): void {
  const state = read();
  if (ticketKey(state.legs) !== key) return;
  const legs = state.legs.map((leg) => {
    const priced = quote.legs.find((q) => q.fixtureId === leg.fixtureId);
    if (!priced || priced.odds === null) return leg;
    const moved = Math.abs(priced.odds - leg.odds) / leg.odds > ODDS_MOVE_SHOWN;
    // Kept until the sheet has shown it: the bar may quote first.
    return { ...leg, odds: priced.odds, oddsMoved: leg.oddsMoved || moved };
  });
  const totals = quote.totals;
  const complete = totals !== null && totals.legCount === legs.length;
  write({
    legs,
    quote: { key, value: quote },
    counted: opts.counted ? countedKey(key, quote.quotedAt) : state.counted,
    checked: complete ? { key, totals } : state.checked,
  });
}

/** The sheet showed the moved odds: said once (07 § 6). */
export function acknowledgeMoves(): void {
  const state = read();
  if (!state.legs.some((leg) => leg.oddsMoved)) return;
  write({
    ...state,
    legs: state.legs.map((leg) => ({ ...leg, oddsMoved: false })),
  });
}

/** A composition is counted once a day (07 § 7). */
export function countedKey(key: string, at: string): string {
  return `${at.slice(0, 10)}#${key}`;
}

export type TicketOutcome = "won" | "lost" | "void" | "pending";

/**
 * A settled ticket (07 § 6): lost as soon as one bet is, won when every bet
 * that counts is, refunded when none counts (all postponed), pending while a
 * match is still to settle. `needed`: the bets that had to pass.
 */
export function ticketOutcome(quote: TicketQuote): {
  outcome: TicketOutcome;
  needed: number;
} {
  const results = quote.legs.map((leg) => leg.result);
  const needed = results.filter((r) => r !== "void").length;
  if (results.includes("lost")) return { outcome: "lost", needed };
  if (results.includes(null)) return { outcome: "pending", needed };
  return { outcome: needed === 0 ? "void" : "won", needed };
}

/** The whole ticket's figures, from before its first match. */
export function checkedTotals(state: TicketState): TicketQuote["totals"] {
  return state.checked && state.checked.key === ticketKey(state.legs)
    ? state.checked.totals
    : null;
}

/** The quote of the current composition, if there is one. */
export function currentQuote(state: TicketState): TicketQuote | null {
  return state.quote && state.quote.key === ticketKey(state.legs)
    ? state.quote.value
    : null;
}
