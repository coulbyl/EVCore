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
  /** The line of a market that keeps it apart (corners, cards, shots, minute). */
  line: number | null;
  kickoffAt: string | null;
  /**
   * `open`: counted. `started`: kick-off passed, out of the figures, shown
   * « Commencé ». `postponed`: out of the figures. `unknown`: no such match.
   */
  state: 'open' | 'started' | 'postponed' | 'unknown';
  /**
   * The 1xBet price now; for the markets of SHEET_NEW_MARKETS, another
   * book's when 1xBet does not price it (never named), as on the sheet.
   * Null when no book prices it any more.
   */
  odds: number | null;
  /**
   * The market's frequency without margin (Shin on that book's group);
   * null when unknown (scorers, shots: no complete group).
   */
  fair: number | null;
  /**
   * Once the match is over (07 § 6, the ticket of yesterday): settled by
   * the rules of the engine's selections, the new markets on the match's
   * facts (statistics, events, lineups). `void` for a postponed or
   * cancelled match, and for facts still unknown past the grace period of
   * the coupons. Null until then: unknown is never lost.
   */
  result: 'won' | 'lost' | 'void' | null;
  score: { home: number; away: number } | null;
};

export type TicketQuote = {
  legs: TicketQuoteLeg[];
  /** Over the open legs priced now; null when none is. */
  totals: {
    legCount: number;
    /** Product of the prices. */
    odds: number;
    /**
     * Product of the fair frequencies: « environ 1 fois sur N ». Null when
     * one of the legs counted has none (a scorer): unknown, never guessed.
     */
    chance: number | null;
  } | null;
  /**
   * « Notre Favori du jour · 8 sur 10 » to compare, of `day` (yesterday's
   * for the ticket of yesterday); null without one. `match`: its one match,
   * for a single-match product (« PSG – Lens 2–0 »).
   */
  hero: {
    couponId: string;
    product: string;
    chance: number | null;
    state: 'upcoming' | 'live' | 'won' | 'lost' | 'void';
    odds: number | null;
    match: {
      home: string;
      away: string;
      score: { home: number; away: number } | null;
    } | null;
  } | null;
  quotedAt: string;
};
