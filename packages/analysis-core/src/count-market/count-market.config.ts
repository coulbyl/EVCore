/**
 * Count markets (corners, cards) priced from a sharp book's ladder
 * (docs/audits/2026-11-05/ML3-CORNERS-CARTONS.md).
 */

/** The sharp book whose ladder is fitted. */
export const COUNT_MARKET_REFERENCE_BOOK = "Pinnacle";

/** A ladder this far from the fitted distribution is refused (RMS on P). */
export const COUNT_MARKET_MAX_RMSE = 0.02;

/** Lines older than this before the book's latest pair are another quote. */
export const COUNT_MARKET_QUOTE_GAP_MINUTES = 60;
