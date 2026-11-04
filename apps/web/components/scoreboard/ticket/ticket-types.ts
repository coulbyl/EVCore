/** Mirror of apps/backend screens/ticket.types.ts (POST /ticket/quote). */
export type TicketQuoteLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  line: number | null;
  kickoffAt: string | null;
  state: "open" | "started" | "postponed" | "unknown";
  /** 1xBet's; another book's for the new markets 1xBet does not price. */
  odds: number | null;
  fair: number | null;
  /** Once the match is over (07 § 6); `void` when postponed. */
  result: "won" | "lost" | "void" | null;
  score: { home: number; away: number } | null;
};

export type TicketTotals = {
  legCount: number;
  odds: number;
  /** Null when a bet counted has no frequency (a scorer): never guessed. */
  chance: number | null;
};

export type TicketQuote = {
  legs: TicketQuoteLeg[];
  totals: TicketTotals | null;
  /** Our hero coupon of the day asked (yesterday's for yesterday's ticket). */
  hero: {
    couponId: string;
    product: string;
    chance: number | null;
    state: "upcoming" | "live" | "won" | "lost" | "void";
    odds: number | null;
    match: {
      home: string;
      away: string;
      score: { home: number; away: number } | null;
    } | null;
  } | null;
  quotedAt: string;
};

type Team = { name: string; shortName: string; logoUrl: string | null };

/** A bet of « Mon ticket », as the device keeps it (07 § 3). */
export type TicketLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  /**
   * The line of the new markets (corners, cards, shots, minute), as the
   * sheet gave it; absent or null for the others (and older tickets).
   */
  line?: number | null;
  /**
   * Named with its team or its player: « Victoire Arsenal », « Saka
   * marque ». The player's name is kept here; the pick carries his id.
   */
  label: string;
  home: Team;
  away: Team;
  kickoffAt: string;
  /** The price at the last quote (or when added). */
  odds: number;
  /** Moved by more than 5 % at the last quote: said once (07 § 6). */
  oddsMoved?: boolean;
};

export type TicketState = {
  legs: TicketLeg[];
  /** The last quote and the composition it priced (`ticketKey`). */
  quote: { key: string; value: TicketQuote } | null;
  /** The composition last counted as verified, and its UTC day. */
  counted: string | null;
  /**
   * The figures of the whole ticket, last seen while every match was still
   * to come: what the ticket of yesterday recalls (« cote 12,4 », « 1 fois
   * sur 46, c'était celle-là »).
   */
  checked?: { key: string; totals: TicketTotals } | null;
};
