/**
 * POST /ticket/quote: « Mon ticket » priced now (refonte 07 § 3–4). The
 * ticket lives on the device; the server prices it and computes its three
 * figures with decimal.js, so the screen and the anonymous count read the
 * same numbers.
 */

/** A bet of the ticket, as priced now. */
export type TicketQuoteLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  kickoffAt: string | null;
  /**
   * `open`: counted. `started`: kick-off passed, out of the figures, shown
   * « Commencé ». `postponed`: out of the figures. `unknown`: no such match.
   */
  state: 'open' | 'started' | 'postponed' | 'unknown';
  /** The 1xBet price now; null when 1xBet no longer prices it. */
  odds: number | null;
  /** The market's frequency without margin (Shin on 1xBet's group). */
  fair: number | null;
};

export type TicketQuote = {
  legs: TicketQuoteLeg[];
  /** Over the open legs priced now; null when none is. */
  totals: {
    legCount: number;
    /** Product of the 1xBet prices. */
    odds: number;
    /** Product of the fair frequencies: « environ 1 fois sur N ». */
    chance: number;
    /** 1 − Π (fair × odds): what 1xBet keeps of the stake over time. */
    keep: number;
  } | null;
  /** « Notre Favori du jour · 8 sur 10 », to compare; null without one. */
  hero: { couponId: string; product: string; chance: number | null } | null;
  quotedAt: string;
};
