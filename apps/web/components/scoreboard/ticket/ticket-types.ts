/** Mirror of apps/backend screens/ticket.types.ts (POST /ticket/quote). */
export type TicketQuoteLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  kickoffAt: string | null;
  state: "open" | "started" | "postponed" | "unknown";
  odds: number | null;
  fair: number | null;
};

export type TicketQuote = {
  legs: TicketQuoteLeg[];
  totals: {
    legCount: number;
    odds: number;
    chance: number;
    keep: number;
  } | null;
  hero: { couponId: string; product: string; chance: number | null } | null;
  quotedAt: string;
};

type Team = { name: string; shortName: string; logoUrl: string | null };

/** A bet of « Mon ticket », as the device keeps it (07 § 3). */
export type TicketLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  /** Named on the server with its team: « Victoire Arsenal ». */
  label: string;
  home: Team;
  away: Team;
  kickoffAt: string;
  /** The 1xBet price at the last quote (or when added). */
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
};
