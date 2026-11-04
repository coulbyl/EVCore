import { Market } from "../types";
import { BOOKMAKER_PREFERENCE } from "../pricing/odds-assembly";

/**
 * Market grid (docs/audits/2026-10-29/ML-V2-PROPOSITION.md § 2.2 and § 3.1,
 * lot ML-1): the score grid implied by a sharp book's prices, used as the
 * engine's probabilities when such prices exist.
 */

/**
 * Books whose prices feed the grid: the two sharpest of the engine's
 * preference order (BOOKMAKER_PREFERENCE), Pinnacle first (64 % of our
 * fixtures), Bet365 otherwise (98 % together, ML-V2-PROPOSITION § 3.1). The
 * first book with a complete 1X2 and at least one complete total-goals line
 * is used, alone: prices are never mixed across books.
 */
export const MARKET_GRID_BOOKMAKERS: readonly string[] =
  BOOKMAKER_PREFERENCE.slice(0, 2);

/** Markets read to fit the grid: the 1X2 and every two-way goal line. */
export const MARKET_GRID_MARKETS: readonly Market[] = [
  Market.ONE_X_TWO,
  Market.OVER_UNDER,
  Market.TEAM_TOTAL_HOME,
  Market.TEAM_TOTAL_AWAY,
];

/**
 * Weight of each 1X2 outcome against one goal line in the least-squares fit,
 * as in the § 2.2 measurement (median squared error 0.0005 over 8.5 targets
 * a fixture).
 */
export const MARKET_GRID_ONE_X_TWO_WEIGHT = 3;

/**
 * Above this weighted root-mean-square gap between the grid and the prices
 * it was fitted on, the prices contradict each other (a stale line, a
 * suspended market) and the grid is not used: the engine falls back to its
 * statistics. An independent Poisson pair reproduces a coherent book within
 * about 0.01.
 */
export const MARKET_GRID_MAX_RMSE = 0.02;

/**
 * How far before the cutoff a price still counts: a Pinnacle quote older
 * than this is not the market of the match any more, and the bound lets the
 * read prune the monthly odds_snapshot partitions.
 */
export const MARKET_GRID_LOOKBACK_DAYS = 14;

/**
 * The goal lines are read at the 1X2's instant: a line priced further than
 * this from the 1X2 row kept (either side) is ignored, so an OVER of one
 * moment is never paired with an UNDER or a 1X2 of another.
 */
export const MARKET_GRID_SAME_INSTANT_MINUTES = 60;

/** λ search bounds, the same as the statistics engine's clamp. */
export const MARKET_GRID_LAMBDA_MIN = 0.05;
export const MARKET_GRID_LAMBDA_MAX = 5;

/** Goals per side in the grid, the same truncation as computePoissonMarkets. */
export const MARKET_GRID_MAX_GOALS = 10;
