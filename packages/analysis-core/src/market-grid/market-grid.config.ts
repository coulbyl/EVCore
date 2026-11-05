import { Market } from "../types";
import { FIRST_HALF_GOAL_FRACTION } from "../probability/poisson";
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
 * Half-time markets of the grid book (sub-model A of lot ML-2,
 * docs/audits/2026-11-05/ML2B-MI-TEMPS.md): when the rows handed to
 * computeMarketGrid hold the grid book's complete first-half 1X2 and at
 * least one complete half-time goal line, first-half λ are fitted on them.
 */
export const MARKET_GRID_FIRST_HALF_MARKETS: readonly Market[] = [
  Market.FIRST_HALF_WINNER,
  Market.OVER_UNDER_HT,
];

/**
 * Share of the full-time λ in the first half, per competition, when the
 * grid book does not price the half (sub-model A of lot ML-2,
 * docs/audits/2026-11-05/ML2B-MI-TEMPS.md). Output of
 * `pnpm --filter @evcore/backtest-core backtest:half-time`: first-half goals
 * over full-time goals of the competition's finished fixtures since 2018,
 * shrunk towards FIRST_HALF_GOAL_FRACTION (0.44) by 500 fixtures; a
 * competition below 200 fixtures reads 0.44.
 */
export const MARKET_GRID_FIRST_HALF_FRACTION: Readonly<Record<string, number>> =
  {
    // Fitted on every finished fixture up to 03/11/2026; the comment is each
    // competition's fixtures and raw fraction.
    ARG1: 0.441, // n 1745, f̂ 0.441
    AUS1: 0.439, // n 525, f̂ 0.438
    AUT1: 0.447, // n 651, f̂ 0.452
    BEL1: 0.451, // n 1040, f̂ 0.456
    BL1: 0.451, // n 996, f̂ 0.456
    BRA1: 0.448, // n 1312, f̂ 0.451
    BRA2: 0.45, // n 1500, f̂ 0.454
    CH: 0.455, // n 1827, f̂ 0.460
    CHI1: 0.437, // n 926, f̂ 0.436
    CSL: 0.447, // n 848, f̂ 0.451
    CZE1: 0.456, // n 918, f̂ 0.464
    D2: 0.447, // n 1014, f̂ 0.450
    D3: 0.447, // n 1260, f̂ 0.450
    DEN1: 0.455, // n 656, f̂ 0.466
    EL1: 0.44, // n 1826, f̂ 0.440
    EL2: 0.447, // n 1834, f̂ 0.449
    ERD: 0.437, // n 1054, f̂ 0.435
    F2: 0.445, // n 1098, f̂ 0.447
    FIN1: 0.436, // n 647, f̂ 0.433
    GRE1: 0.446, // n 773, f̂ 0.450
    I2: 0.445, // n 1269, f̂ 0.447
    IRL1: 0.442, // n 723, f̂ 0.443
    J1: 0.428, // n 1396, f̂ 0.424
    KOR1: 0.409, // n 810, f̂ 0.390
    KSA1: 0.437, // n 1022, f̂ 0.436
    L1: 0.438, // n 1006, f̂ 0.436
    LL: 0.44, // n 1249, f̂ 0.440
    MLS: 0.445, // n 1405, f̂ 0.447
    MX1: 0.445, // n 1143, f̂ 0.447
    NOR1: 0.444, // n 876, f̂ 0.446
    NOR2: 0.443, // n 915, f̂ 0.444
    PL: 0.441, // n 1610, f̂ 0.442
    POL1: 0.449, // n 1030, f̂ 0.454
    POL2: 0.449, // n 1037, f̂ 0.453
    POR: 0.44, // n 1014, f̂ 0.440
    RUS1: 0.442, // n 835, f̂ 0.443
    SA: 0.436, // n 1239, f̂ 0.435
    SCO1: 0.446, // n 771, f̂ 0.450
    SP2: 0.436, // n 1534, f̂ 0.434
    SRB1: 0.45, // n 981, f̂ 0.455
    SUI1: 0.438, // n 760, f̂ 0.436
    SUI2: 0.444, // n 593, f̂ 0.447
    SVN1: 0.444, // n 583, f̂ 0.448
    SWE1: 0.441, // n 899, f̂ 0.441
    SWE2: 0.437, // n 908, f̂ 0.435
    TUR1: 0.439, // n 1117, f̂ 0.438
    TUR2: 0.446, // n 1208, f̂ 0.449
    UCL: 0.444, // n 918, f̂ 0.446
    UECL: 0.419, // n 1527, f̂ 0.413
    UEL: 0.454, // n 848, f̂ 0.462
    UNL: 0.443, // n 291, f̂ 0.448
  };

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

/**
 * Dixon-Coles dependence ρ of the market grid, per competition (sub-model D
 * of lot ML-2, docs/audits/2026-11-04/ML2A-DEPENDANCE-BUTS.md). Output of
 * `pnpm --filter @evcore/backtest-core backtest:goal-dependence`, to re-fit
 * like LEAGUE_STRENGTH_MAP: a competition's ρ is its maximum-likelihood ρ on
 * the market grids of its past fixtures, shrunk towards the global ρ, and a
 * competition below the script's minimum of fixtures reads the global ρ.
 */
export const MARKET_GRID_RHO: {
  global: number;
  byCompetition: Readonly<Record<string, number>>;
} = {
  // Fitted on 14 384 market grids (all history up to 03/11/2026); the
  // comment is each competition's fixtures and raw maximum-likelihood ρ.
  global: -0.05,
  byCompetition: {
    ARG1: -0.013, // n 255, ρ̂ 0.06
    BEL1: -0.05, // n 254, ρ̂ -0.05
    BL1: -0.078, // n 231, ρ̂ -0.14
    BRA1: -0.059, // n 376, ρ̂ -0.07
    BRA2: -0.044, // n 222, ρ̂ -0.03
    CH: -0.038, // n 724, ρ̂ -0.03
    CHI1: -0.01, // n 334, ρ̂ 0.05
    CSL: -0.05, // n 223, ρ̂ -0.05
    D2: -0.022, // n 224, ρ̂ 0.04
    D3: -0.027, // n 301, ρ̂ 0.01
    EL1: -0.05, // n 735, ρ̂ -0.05
    EL2: -0.014, // n 750, ρ̂ 0.01
    ERD: -0.074, // n 264, ρ̂ -0.12
    F2: -0.022, // n 328, ρ̂ 0.02
    FIN1: -0.068, // n 270, ρ̂ -0.1
    I2: -0.056, // n 235, ρ̂ -0.07
    J1: -0.055, // n 490, ρ̂ -0.06
    KOR1: -0.063, // n 391, ρ̂ -0.08
    L1: -0.071, // n 364, ρ̂ -0.1
    LL: -0.046, // n 332, ρ̂ -0.04
    MLS: -0.07, // n 480, ρ̂ -0.09
    MX1: -0.05, // n 359, ρ̂ -0.05
    NOR1: -0.04, // n 258, ρ̂ -0.02
    PL: -0.038, // n 331, ρ̂ -0.02
    POL1: -0.089, // n 384, ρ̂ -0.14
    POR: -0.065, // n 294, ρ̂ -0.09
    SA: -0.05, // n 359, ρ̂ -0.05
    SCO1: -0.047, // n 237, ρ̂ -0.04
    SP2: -0.05, // n 342, ρ̂ -0.05
    SWE1: -0.042, // n 352, ρ̂ -0.03
    SWE2: -0.059, // n 450, ρ̂ -0.07
    TUR1: -0.077, // n 312, ρ̂ -0.12
    UCL: -0.026, // n 216, ρ̂ 0.03
    UECL: -0.024, // n 373, ρ̂ 0.01
    UEL: -0.064, // n 255, ρ̂ -0.09
  },
};

/** ρ of a competition's market grid (the global ρ when it has none). */
export function marketGridRho(
  competitionCode: string | null | undefined,
): number {
  if (!competitionCode) return MARKET_GRID_RHO.global;
  return (
    MARKET_GRID_RHO.byCompetition[competitionCode] ?? MARKET_GRID_RHO.global
  );
}

/** First-half share of λ of a competition's market grid (0.44 without one). */
export function marketGridFirstHalfFraction(
  competitionCode: string | null | undefined,
): number {
  if (!competitionCode) return FIRST_HALF_GOAL_FRACTION;
  return (
    MARKET_GRID_FIRST_HALF_FRACTION[competitionCode] ?? FIRST_HALF_GOAL_FRACTION
  );
}
