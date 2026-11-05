import Decimal from "decimal.js";
import { Market } from "../types";
import type { RawOddsRow } from "../pricing/odds-assembly";
import { shinOneXTwo, shinOutcomeGroups } from "../pricing/shin";
import { overUnderPickLine } from "../pricing/outcome-groups";
import {
  buildPoissonDistributions,
  deriveMarketsFromPoisson,
  FIRST_HALF_GOAL_FRACTION,
  type FirstHalfSplit,
  poissonProbaFromDistributions,
  scoreCells,
} from "../probability/poisson";
import type { ThreeWayProba } from "../probability/markets";
import type { MatchProbabilities } from "../selection/types";
import {
  MARKET_GRID_BOOKMAKERS,
  MARKET_GRID_FIRST_HALF_MARKETS,
  MARKET_GRID_LAMBDA_MAX,
  MARKET_GRID_LAMBDA_MIN,
  MARKET_GRID_MARKETS,
  MARKET_GRID_MAX_GOALS,
  MARKET_GRID_MAX_RMSE,
  MARKET_GRID_ONE_X_TWO_WEIGHT,
  MARKET_GRID_LOOKBACK_DAYS,
  MARKET_GRID_SAME_INSTANT_MINUTES,
} from "./market-grid.config";

/**
 * The score grid implied by a sharp book (lot ML-1,
 * docs/audits/2026-10-29/ML-V2-PROPOSITION.md § 2.2).
 *
 * 1. The first book of MARKET_GRID_BOOKMAKERS with a complete 1X2 and at
 *    least one complete total-goals line at `cutoff` is read, alone.
 * 2. Each complete group loses its margin by Shin's method
 *    (`shinProbabilities`), never proportionally.
 * 3. λ home and λ away of two independent Poisson laws are fitted by
 *    weighted least squares on those fair probabilities (1X2 × 3, every
 *    total and team-total line × 1).
 * 4. Every market is derived from that grid by the same functions as the
 *    statistics engine (`deriveMarketsFromPoisson`), so the channels read the
 *    same shape; the 1X2 itself is the book's fair 1X2, which an independent
 *    Poisson pair cannot always reproduce exactly (the draw).
 *
 * The dependence ρ (Dixon-Coles) is never fitted per fixture (noisy lines):
 * the caller may pass a per-league ρ (sub-model D of lot ML-2,
 * MARKET_GRID_RHO in market-grid.config.ts); λ are then fitted under that ρ,
 * so the grid still reproduces the 1X2 and goal-line prices, and every
 * derived market reads the dependent grid. ρ 0 = independent Poisson.
 *
 * Solver variables are floating point, as in `shinProbabilities`; every
 * probability handed to the engine is a Decimal.
 */

export type MarketGridLine = {
  market: Market;
  line: number;
  overOdds: Decimal;
  underOdds: Decimal;
  fairOver: Decimal;
};

export type MarketGridQuotes = {
  bookmaker: string;
  /** Latest bookmaker time among the rows used. */
  snapshotAt: Date;
  oneXTwoOdds: { home: Decimal; draw: Decimal; away: Decimal };
  fairOneXTwo: ThreeWayProba;
  lines: MarketGridLine[];
};

export type MarketGridFit = {
  lambdaHome: number;
  lambdaAway: number;
  /** Dixon-Coles ρ the λ were fitted under (0 = independent). */
  rho: number;
  /** Weighted root-mean-square gap between the grid and its targets. */
  rmse: number;
};

/** How the grid's first-half λ were obtained. */
export type MarketGridFirstHalf =
  | {
      source: "prices";
      lambdaHome: number;
      lambdaAway: number;
      rmse: number;
      snapshotAt: Date;
    }
  | {
      source: "fraction";
      fraction: number;
      /** Why the half-time prices were not used (null: none were read). */
      reason: "no_quotes" | "fit_error" | "inconsistent" | null;
    };

export type MarketGridResult =
  | {
      status: "ok";
      quotes: MarketGridQuotes;
      fit: MarketGridFit;
      firstHalf: MarketGridFirstHalf;
      probabilities: MatchProbabilities;
    }
  | {
      status: "unavailable";
      reason: "no_sharp_quotes" | "fit_error";
      quotes: MarketGridQuotes | null;
      fit: MarketGridFit | null;
    };

type FitTargets = {
  oneXTwo: ThreeWayProba;
  lines: ReadonlyArray<{ market: Market; line: number; fairOver: Decimal }>;
};

function latest<T extends { snapshotAt: Date }>(rows: readonly T[]): T | null {
  let best: T | null = null;
  for (const row of rows) {
    if (!best || row.snapshotAt.getTime() > best.snapshotAt.getTime()) {
      best = row;
    }
  }
  return best;
}

function toDecimal(value: { toString(): string } | null): Decimal | null {
  if (value === null) return null;
  const d = new Decimal(value.toString());
  return d.gt(1) ? d : null;
}

function quotesForBook(
  rows: readonly RawOddsRow[],
  bookmaker: string,
): MarketGridQuotes | null {
  const bookRows = rows.filter((row) => row.bookmaker === bookmaker);

  const oneXTwoRow = latest(
    bookRows.filter(
      (row) =>
        row.market === Market.ONE_X_TWO &&
        toDecimal(row.homeOdds) &&
        toDecimal(row.drawOdds) &&
        toDecimal(row.awayOdds),
    ),
  );
  if (!oneXTwoRow) return null;
  const oneXTwoOdds = {
    home: toDecimal(oneXTwoRow.homeOdds) as Decimal,
    draw: toDecimal(oneXTwoRow.drawOdds) as Decimal,
    away: toDecimal(oneXTwoRow.awayOdds) as Decimal,
  };
  const fairOneXTwo = shinOneXTwo(oneXTwoOdds);
  if (!fairOneXTwo) return null;

  // Every line is read at the 1X2's instant: a row priced further than
  // MARKET_GRID_SAME_INSTANT_MINUTES from it is another market state and is
  // ignored, so the grid never pairs an OVER of one moment with an UNDER or
  // a 1X2 of another. Then the latest row per (market, pick) in that window.
  const anchor = oneXTwoRow.snapshotAt.getTime();
  const tolerance = MARKET_GRID_SAME_INSTANT_MINUTES * 60_000;
  const byPick = new Map<string, RawOddsRow[]>();
  for (const row of bookRows) {
    if (row.market === Market.ONE_X_TWO || !row.pick) continue;
    if (!toDecimal(row.odds)) continue;
    if (Math.abs(row.snapshotAt.getTime() - anchor) > tolerance) continue;
    const key = `${row.market}|${row.pick}`;
    const bucket = byPick.get(key);
    if (bucket) bucket.push(row);
    else byPick.set(key, [row]);
  }
  const picked = [...byPick.values()].map(
    (bucket) => latest(bucket) as RawOddsRow,
  );

  // Margin removed per complete OVER/UNDER pair (outcome-groups.ts pairs
  // OVER_x with UNDER_x only), by Shin.
  const priced = shinOutcomeGroups(
    picked.map((row) => ({
      fixtureId: "",
      market: row.market,
      pick: row.pick as string,
      odds: Number(row.odds),
      row,
    })),
  );
  const pairs = new Map<
    string,
    {
      market: Market;
      line: number;
      over?: Decimal;
      under?: Decimal;
      fairOver?: Decimal;
    }
  >();
  let snapshotAt = oneXTwoRow.snapshotAt;
  for (const entry of priced) {
    const parsed = overUnderPickLine(entry.pick);
    if (!parsed) continue;
    const key = `${entry.market}|${parsed.line}`;
    const pair = pairs.get(key) ?? {
      market: entry.row.market,
      line: parsed.line,
    };
    const odds = toDecimal(entry.row.odds) as Decimal;
    if (parsed.side === "OVER") {
      pair.over = odds;
      pair.fairOver = entry.fair;
    } else {
      pair.under = odds;
    }
    pairs.set(key, pair);
    if (entry.row.snapshotAt.getTime() > snapshotAt.getTime()) {
      snapshotAt = entry.row.snapshotAt;
    }
  }

  const lines: MarketGridLine[] = [];
  for (const pair of pairs.values()) {
    if (!pair.over || !pair.under || !pair.fairOver) continue;
    lines.push({
      market: pair.market,
      line: pair.line,
      overOdds: pair.over,
      underOdds: pair.under,
      fairOver: pair.fairOver,
    });
  }
  if (!lines.some((line) => line.market === Market.OVER_UNDER)) return null;

  lines.sort((a, b) =>
    a.market === b.market ? a.line - b.line : a.market < b.market ? -1 : 1,
  );
  return { bookmaker, snapshotAt, oneXTwoOdds, fairOneXTwo, lines };
}

/**
 * The prices the grid is fitted on: the first book of MARKET_GRID_BOOKMAKERS
 * with a complete 1X2 and at least one complete total-goals line among the
 * rows priced at or before `cutoff`, within MARKET_GRID_LOOKBACK_DAYS (the
 * latest 1X2, then the lines priced within MARKET_GRID_SAME_INSTANT_MINUTES
 * of it, latest row per pick). `null` when no book qualifies.
 */
export function selectMarketGridQuotes(
  rows: readonly RawOddsRow[],
  cutoff: Date,
): MarketGridQuotes | null {
  const since = cutoff.getTime() - MARKET_GRID_LOOKBACK_DAYS * 86_400_000;
  const usable = rows.filter(
    (row) =>
      row.snapshotAt.getTime() <= cutoff.getTime() &&
      row.snapshotAt.getTime() >= since &&
      MARKET_GRID_MARKETS.includes(row.market),
  );
  for (const bookmaker of MARKET_GRID_BOOKMAKERS) {
    const quotes = quotesForBook(usable, bookmaker);
    if (quotes) return quotes;
  }
  return null;
}

type ModelTargets = {
  rho: number;
  oneXTwo: [number, number, number];
  lines: ReadonlyArray<{ market: Market; line: number; over: number }>;
};

type Evaluation = { x: [number, number]; residuals: number[]; loss: number };

/** P(goals > line) of a goal distribution. */
function overLine(dist: readonly number[], line: number): number {
  return dist.reduce((sum, p, goals) => (goals > line ? sum + p : sum), 0);
}

/** Residuals (grid − target) and weighted loss of the grid at `x`. */
function evaluate(x: [number, number], targets: ModelTargets): Evaluation {
  const { distHome, distAway } = buildPoissonDistributions(
    x[0],
    x[1],
    MARKET_GRID_MAX_GOALS,
  );
  const cell = scoreCells({
    homeDist: distHome,
    awayDist: distAway,
    lambdaHome: x[0],
    lambdaAway: x[1],
    rho: targets.rho,
  });
  const oneXTwo = poissonProbaFromDistributions(distHome, distAway, cell);
  const total = new Array<number>(distHome.length + distAway.length).fill(0);
  for (let h = 0; h < distHome.length; h++) {
    for (let a = 0; a < distAway.length; a++) {
      total[h + a] = (total[h + a] ?? 0) + cell(h, a);
    }
  }
  const residuals = [
    oneXTwo.home.toNumber() - targets.oneXTwo[0],
    oneXTwo.draw.toNumber() - targets.oneXTwo[1],
    oneXTwo.away.toNumber() - targets.oneXTwo[2],
  ];
  for (const target of targets.lines) {
    const dist =
      target.market === Market.TEAM_TOTAL_HOME
        ? distHome
        : target.market === Market.TEAM_TOTAL_AWAY
          ? distAway
          : total;
    residuals.push(overLine(dist, target.line) - target.over);
  }
  const loss = residuals.reduce(
    (sum, r, i) => sum + (i < 3 ? MARKET_GRID_ONE_X_TWO_WEIGHT : 1) * r * r,
    0,
  );
  return { x, residuals, loss };
}

function clampLambda(value: number): number {
  return Math.min(
    MARKET_GRID_LAMBDA_MAX,
    Math.max(MARKET_GRID_LAMBDA_MIN, value),
  );
}

/**
 * Starting point read off the prices: the Poisson total whose P(> line)
 * matches the fair total-goals line closest to 2.5 (bisection), split by
 * the 1X2 (home share = P(home) + P(draw) / 2).
 */
function startFromPrices(targets: ModelTargets): [number, number] {
  const totals = targets.lines.filter((l) => l.market === Market.OVER_UNDER);
  const reference = totals.reduce<(typeof totals)[number] | null>(
    (best, l) =>
      !best || Math.abs(l.line - 2.5) < Math.abs(best.line - 2.5) ? l : best,
    null,
  );
  let mu = 2.6;
  if (reference) {
    let lo = 2 * MARKET_GRID_LAMBDA_MIN;
    let hi = 2 * MARKET_GRID_LAMBDA_MAX;
    for (let i = 0; i < 60; i++) {
      mu = (lo + hi) / 2;
      const { distHome } = buildPoissonDistributions(
        mu,
        MARKET_GRID_LAMBDA_MIN,
        2 * MARKET_GRID_MAX_GOALS,
      );
      if (overLine(distHome, reference.line) < reference.over) lo = mu;
      else hi = mu;
    }
  }
  const share = Math.min(
    0.9,
    Math.max(0.1, targets.oneXTwo[0] + targets.oneXTwo[1] / 2),
  );
  return [clampLambda(mu * share), clampLambda(mu * (1 - share))];
}

const MAX_ITERATIONS = 100;
const STEP = 1e-6;
const TOLERANCE = 1e-12;

/**
 * Levenberg-Marquardt on (λ home, λ away), numerical Jacobian, clamped. The
 * residuals of the last accepted step are carried to the next iteration.
 */
function levenbergMarquardt(
  start: [number, number],
  targets: ModelTargets,
): Evaluation {
  let current = evaluate(start, targets);
  let mu = 1e-3;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const { x, residuals } = current;
    const jacobian = [0, 1].map((k) => {
      const up: [number, number] = [x[0], x[1]];
      const down: [number, number] = [x[0], x[1]];
      up[k] = (up[k] as number) + STEP;
      down[k] = (down[k] as number) - STEP;
      const rUp = evaluate(up, targets).residuals;
      const rDown = evaluate(down, targets).residuals;
      return rUp.map((r, i) => (r - (rDown[i] ?? 0)) / (2 * STEP));
    });
    const [j0, j1] = jacobian as [number[], number[]];
    let a00 = 0;
    let a01 = 0;
    let a11 = 0;
    let g0 = 0;
    let g1 = 0;
    residuals.forEach((r, i) => {
      const w = i < 3 ? MARKET_GRID_ONE_X_TWO_WEIGHT : 1;
      const d0 = j0[i] ?? 0;
      const d1 = j1[i] ?? 0;
      a00 += w * d0 * d0;
      a01 += w * d0 * d1;
      a11 += w * d1 * d1;
      g0 += w * d0 * r;
      g1 += w * d1 * r;
    });
    let improved = false;
    for (let attempt = 0; attempt < 10 && !improved; attempt++) {
      const b00 = a00 * (1 + mu);
      const b11 = a11 * (1 + mu);
      const det = b00 * b11 - a01 * a01;
      if (Math.abs(det) < 1e-300) break;
      const step0 = -(b11 * g0 - a01 * g1) / det;
      const step1 = -(b00 * g1 - a01 * g0) / det;
      const candidate = evaluate(
        [clampLambda(x[0] + step0), clampLambda(x[1] + step1)],
        targets,
      );
      if (candidate.loss < current.loss) {
        const gain = current.loss - candidate.loss;
        current = candidate;
        mu = Math.max(mu / 3, 1e-12);
        improved = true;
        if (gain < TOLERANCE) return current;
      } else {
        mu *= 4;
      }
    }
    if (!improved) break;
  }
  return current;
}

/**
 * λ home and λ away whose independent Poisson grid reproduces the fair
 * targets best (weighted least squares from one start read off the prices),
 * under the dependence `rho` (0 = independent). Team totals do not depend on
 * ρ (Dixon-Coles keeps the marginals); the 1X2 and the totals do.
 * Deterministic: same targets → same λ.
 */
export function fitMarketGridLambdas(
  targets: FitTargets,
  rho = 0,
): MarketGridFit {
  const modelTargets: ModelTargets = {
    rho,
    oneXTwo: [
      targets.oneXTwo.home.toNumber(),
      targets.oneXTwo.draw.toNumber(),
      targets.oneXTwo.away.toNumber(),
    ],
    lines: targets.lines.map((line) => ({
      market: line.market,
      line: line.line,
      over: line.fairOver.toNumber(),
    })),
  };
  const solved = levenbergMarquardt(
    startFromPrices(modelTargets),
    modelTargets,
  );
  const totalWeight =
    3 * MARKET_GRID_ONE_X_TWO_WEIGHT + modelTargets.lines.length;
  return {
    lambdaHome: solved.x[0],
    lambdaAway: solved.x[1],
    rho,
    rmse: Math.sqrt(solved.loss / totalWeight),
  };
}

/**
 * The grid book's half-time prices at `cutoff`: the latest complete
 * first-half 1X2, and the half-time goal lines priced within
 * MARKET_GRID_SAME_INSTANT_MINUTES of it (latest row per pick), margin
 * removed by Shin per group. `null` without a complete first-half 1X2 and
 * at least one complete line.
 */
export function selectFirstHalfQuotes(
  rows: readonly RawOddsRow[],
  options: { bookmaker: string; cutoff: Date },
): {
  snapshotAt: Date;
  fairFirstHalf: ThreeWayProba;
  lines: Array<{ market: Market; line: number; fairOver: Decimal }>;
} | null {
  const { bookmaker, cutoff } = options;
  const since = cutoff.getTime() - MARKET_GRID_LOOKBACK_DAYS * 86_400_000;
  const usable = rows.filter(
    (row) =>
      row.bookmaker === bookmaker &&
      MARKET_GRID_FIRST_HALF_MARKETS.includes(row.market) &&
      row.pick !== null &&
      toDecimal(row.odds) !== null &&
      row.snapshotAt.getTime() <= cutoff.getTime() &&
      row.snapshotAt.getTime() >= since,
  );
  const anchorRow = latest(
    usable.filter((row) => row.market === Market.FIRST_HALF_WINNER),
  );
  if (!anchorRow) return null;
  const anchor = anchorRow.snapshotAt.getTime();
  const tolerance = MARKET_GRID_SAME_INSTANT_MINUTES * 60_000;
  const byPick = new Map<string, RawOddsRow[]>();
  for (const row of usable) {
    if (Math.abs(row.snapshotAt.getTime() - anchor) > tolerance) continue;
    const key = `${row.market}|${row.pick}`;
    const bucket = byPick.get(key);
    if (bucket) bucket.push(row);
    else byPick.set(key, [row]);
  }
  const priced = shinOutcomeGroups(
    [...byPick.values()].map((bucket) => {
      const row = latest(bucket) as RawOddsRow;
      return {
        fixtureId: "",
        market: row.market,
        pick: row.pick as string,
        odds: Number(row.odds),
      };
    }),
  );
  const fair = new Map(priced.map((r) => [`${r.market}|${r.pick}`, r.fair]));
  const home = fair.get(`${Market.FIRST_HALF_WINNER}|HOME`);
  const draw = fair.get(`${Market.FIRST_HALF_WINNER}|DRAW`);
  const away = fair.get(`${Market.FIRST_HALF_WINNER}|AWAY`);
  if (!home || !draw || !away) return null;
  const lines: Array<{ market: Market; line: number; fairOver: Decimal }> = [];
  for (const r of priced) {
    if (r.market !== Market.OVER_UNDER_HT) continue;
    const parsed = overUnderPickLine(r.pick);
    if (!parsed || parsed.side !== "OVER") continue;
    // Fitted as a total-goals line of the first-half grid.
    lines.push({
      market: Market.OVER_UNDER,
      line: parsed.line,
      fairOver: r.fair,
    });
  }
  if (lines.length === 0) return null;
  lines.sort((a, b) => a.line - b.line);
  return {
    snapshotAt: new Date(anchor),
    fairFirstHalf: { home, draw, away },
    lines,
  };
}

/**
 * First-half λ of the grid: fitted on the grid book's half-time prices when
 * it has them (same least squares as the full-time grid, refused above
 * MARKET_GRID_MAX_RMSE or when a first-half λ is not below its full-time
 * λ), else the full-time λ times `fraction`.
 */
function gridFirstHalf(input: {
  rows: readonly RawOddsRow[];
  cutoff: Date;
  quotes: MarketGridQuotes;
  fit: MarketGridFit;
  fraction: number;
}): MarketGridFirstHalf {
  const half = selectFirstHalfQuotes(input.rows, {
    bookmaker: input.quotes.bookmaker,
    cutoff: input.cutoff,
  });
  const fallback = (
    reason: "no_quotes" | "fit_error" | "inconsistent" | null,
  ): MarketGridFirstHalf => ({
    source: "fraction",
    fraction: input.fraction,
    reason,
  });
  if (!half) {
    const anyRow = input.rows.some((row) =>
      MARKET_GRID_FIRST_HALF_MARKETS.includes(row.market),
    );
    return fallback(anyRow ? "no_quotes" : null);
  }
  const fit = fitMarketGridLambdas({
    oneXTwo: half.fairFirstHalf,
    lines: half.lines,
  });
  if (!(fit.rmse <= MARKET_GRID_MAX_RMSE)) return fallback("fit_error");
  if (
    fit.lambdaHome >= input.fit.lambdaHome - MARKET_GRID_LAMBDA_MIN ||
    fit.lambdaAway >= input.fit.lambdaAway - MARKET_GRID_LAMBDA_MIN
  ) {
    return fallback("inconsistent");
  }
  return {
    source: "prices",
    lambdaHome: fit.lambdaHome,
    lambdaAway: fit.lambdaAway,
    rmse: fit.rmse,
    snapshotAt: half.snapshotAt,
  };
}

const firstHalfSplit = (half: MarketGridFirstHalf): FirstHalfSplit =>
  half.source === "prices"
    ? { lambdaHome: half.lambdaHome, lambdaAway: half.lambdaAway }
    : { fraction: half.fraction };

/**
 * Every market probability from a fitted grid, in the statistics engine's
 * shape: the book's fair 1X2, everything else derived from the grid.
 */
export function marketGridProbabilities(
  fit: Pick<MarketGridFit, "lambdaHome" | "lambdaAway"> & {
    rho?: number;
    firstHalf?: FirstHalfSplit;
  },
  fairOneXTwo: ThreeWayProba,
): MatchProbabilities {
  return {
    ...fairOneXTwo,
    ...deriveMarketsFromPoisson({
      lambdaHome: fit.lambdaHome,
      lambdaAway: fit.lambdaAway,
      oneXTwo: fairOneXTwo,
      maxGoals: MARKET_GRID_MAX_GOALS,
      rho: fit.rho,
      firstHalf: fit.firstHalf,
    }),
  };
}

/**
 * The market grid of a fixture at `cutoff`, from its raw odds rows (any
 * book, any market: the rest is ignored). `unavailable` when no sharp book
 * prices a complete 1X2 and a total-goals line, or when its prices
 * contradict each other beyond MARKET_GRID_MAX_RMSE; the caller then keeps
 * its statistics engine. `options.rho`: the league's Dixon-Coles dependence
 * (`marketGridRho`), 0 or absent = independent. First-half λ come from the
 * grid book's half-time prices among `rows` (MARKET_GRID_FIRST_HALF_MARKETS)
 * when they fit, else from `options.firstHalfFraction` of the full-time λ
 * (FIRST_HALF_GOAL_FRACTION when absent).
 */
export function computeMarketGrid(
  rows: readonly RawOddsRow[],
  cutoff: Date,
  options: { rho?: number; firstHalfFraction?: number } = {},
): MarketGridResult {
  const quotes = selectMarketGridQuotes(rows, cutoff);
  if (!quotes) {
    return {
      status: "unavailable",
      reason: "no_sharp_quotes",
      quotes: null,
      fit: null,
    };
  }
  const fit = fitMarketGridLambdas(
    { oneXTwo: quotes.fairOneXTwo, lines: quotes.lines },
    options.rho ?? 0,
  );
  if (!(fit.rmse <= MARKET_GRID_MAX_RMSE)) {
    return { status: "unavailable", reason: "fit_error", quotes, fit };
  }
  const firstHalf = gridFirstHalf({
    rows,
    cutoff,
    quotes,
    fit,
    fraction: options.firstHalfFraction ?? FIRST_HALF_GOAL_FRACTION,
  });
  return {
    status: "ok",
    quotes,
    fit,
    firstHalf,
    probabilities: marketGridProbabilities(
      { ...fit, firstHalf: firstHalfSplit(firstHalf) },
      quotes.fairOneXTwo,
    ),
  };
}

/**
 * JSON trace of a grid for `model_run.features.market_grid`: the book, the
 * prices it read, the fitted λ and the fit error, or why it was not used.
 */
export function summarizeMarketGrid(result: MarketGridResult): {
  status: MarketGridResult["status"];
  reason: string | null;
  bookmaker: string | null;
  snapshotAt: string | null;
  lambdaHome: number | null;
  lambdaAway: number | null;
  rho: number | null;
  rmse: number | null;
  prices: {
    oneXTwo: { home: number; draw: number; away: number };
    lines: { market: string; line: number; over: number; under: number }[];
  } | null;
} {
  const { quotes, fit } = result;
  return {
    status: result.status,
    reason: result.status === "unavailable" ? result.reason : null,
    bookmaker: quotes?.bookmaker ?? null,
    snapshotAt: quotes?.snapshotAt.toISOString() ?? null,
    lambdaHome: fit?.lambdaHome ?? null,
    lambdaAway: fit?.lambdaAway ?? null,
    rho: fit?.rho ?? null,
    rmse: fit?.rmse ?? null,
    prices: quotes
      ? {
          oneXTwo: {
            home: quotes.oneXTwoOdds.home.toNumber(),
            draw: quotes.oneXTwoOdds.draw.toNumber(),
            away: quotes.oneXTwoOdds.away.toNumber(),
          },
          lines: quotes.lines.map((line) => ({
            market: line.market,
            line: line.line,
            over: line.overOdds.toNumber(),
            under: line.underOdds.toNumber(),
          })),
        }
      : null,
  };
}
