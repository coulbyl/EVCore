/**
 * The few bytes every player page needs about « Mon ticket »: is there a
 * bet, is this match in it. Read straight from the device's storage, so the
 * bar, its store and its pricing load only once the ticket holds a bet
 * (C7: they weighed ~4 kio on every page).
 */
export const TICKET_KEY = "evcore.ticket.v1";
/** Dispatched by the store on every change in this tab. */
export const TICKET_EVENT = "evcore:ticket";

export function readTicketRaw(): string | null {
  try {
    return window.localStorage.getItem(TICKET_KEY);
  } catch {
    return null;
  }
}

export function subscribeTicketSignal(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === TICKET_KEY) listener();
  };
  window.addEventListener(TICKET_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(TICKET_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

let cache: { raw: string | null; ids: ReadonlySet<string> } | null = null;

/** The matches of the ticket, from its stored form. */
export function ticketFixtureIds(): ReadonlySet<string> {
  const raw = readTicketRaw();
  if (cache?.raw === raw) return cache.ids;
  let ids: ReadonlySet<string> = new Set();
  try {
    const parsed = raw
      ? (JSON.parse(raw) as { legs?: { fixtureId: string }[] })
      : null;
    ids = new Set((parsed?.legs ?? []).map((leg) => leg.fixtureId));
  } catch {
    // Unreadable: no bet.
  }
  cache = { raw, ids };
  return ids;
}
