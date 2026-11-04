import Decimal from "decimal.js";
import { Market } from "../types";
import type { RawOddsRow } from "../pricing/odds-assembly";
import { shinProbabilities } from "../pricing/shin";
import {
  buildPoissonDistributions,
  deriveMarketsFromPoisson,
} from "../probability/poisson";
import type { ThreeWayProba } from "../probability/markets";
import type { MatchProbabilities } from "../selection/types";
import {
  MARKET_GRID_BOOKMAKERS,
  MARKET_GRID_LAMBDA_MAX,
  MARKET_GRID_LAMBDA_MIN,
  MARKET_GRID_MARKETS,
  MARKET_GRID_MAX_GOALS,
  MARKET_GRID_MAX_RMSE,
  MARKET_GRID_ONE_X_TWO_WEIGHT,
  MARKET_GRID_LOOKBACK_DAYS,
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
 * The dependence ρ (Dixon-Coles) is not fitted: a per-fixture ρ on noisy
 * lines is what sub-model D of lot ML-2 replaces with a per-league value, and
 * the engine's derivations assume independent margins (Dixon-Coles was
 * rejected on our data on 2026-06-30, poisson.ts).
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
  /** Weighted root-mean-square gap between the grid and its targets. */
  rmse: number;
};

export type MarketGridResult =
  | {
      status: "ok";
      quotes: MarketGridQuotes;
      fit: MarketGridFit;
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

const LINE_PICK = /^(OVER|UNDER)(?:_(\d+)_5)?$/;

/** Line of a two-way goals pick: "OVER" / "UNDER" are the 2.5 line. */
function parseLinePick(
  pick: string,
): { side: "OVER" | "UNDER"; line: number } | null {
  const match = LINE_PICK.exec(pick);
  if (!match) return null;
  const side = match[1] as "OVER" | "UNDER";
  const line = match[2] === undefined ? 2.5 : Number(match[2]) + 0.5;
  return { side, line };
}

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
  const fair = shinProbabilities([
    { pick: "HOME", odds: oneXTwoOdds.home },
    { pick: "DRAW", odds: oneXTwoOdds.draw },
    { pick: "AWAY", odds: oneXTwoOdds.away },
  ]);
  const home = fair?.get("HOME");
  const draw = fair?.get("DRAW");
  const away = fair?.get("AWAY");
  if (!home || !draw || !away) return null;

  // Latest row per (market, pick), then complete OVER/UNDER pairs per line.
  const latestByPick = new Map<string, RawOddsRow>();
  for (const row of bookRows) {
    if (row.market === Market.ONE_X_TWO || !row.pick) continue;
    if (!toDecimal(row.odds)) continue;
    const key = `${row.market}|${row.pick}`;
    const current = latestByPick.get(key);
    if (!current || row.snapshotAt.getTime() > current.snapshotAt.getTime()) {
      latestByPick.set(key, row);
    }
  }
  const pairs = new Map<
    string,
    { market: Market; line: number; over?: RawOddsRow; under?: RawOddsRow }
  >();
  for (const row of latestByPick.values()) {
    const parsed = parseLinePick(row.pick as string);
    if (!parsed) continue;
    const key = `${row.market}|${parsed.line}`;
    const pair = pairs.get(key) ?? { market: row.market, line: parsed.line };
    if (parsed.side === "OVER") pair.over = row;
    else pair.under = row;
    pairs.set(key, pair);
  }

  const lines: MarketGridLine[] = [];
  let snapshotAt = oneXTwoRow.snapshotAt;
  for (const pair of pairs.values()) {
    if (!pair.over || !pair.under) continue;
    const overOdds = toDecimal(pair.over.odds) as Decimal;
    const underOdds = toDecimal(pair.under.odds) as Decimal;
    const fairLine = shinProbabilities([
      { pick: "OVER", odds: overOdds },
      { pick: "UNDER", odds: underOdds },
    ]);
    const fairOver = fairLine?.get("OVER");
    if (!fairOver) continue;
    lines.push({
      market: pair.market,
      line: pair.line,
      overOdds,
      underOdds,
      fairOver,
    });
    for (const row of [pair.over, pair.under]) {
      if (row.snapshotAt.getTime() > snapshotAt.getTime()) {
        snapshotAt = row.snapshotAt;
      }
    }
  }
  if (!lines.some((line) => line.market === Market.OVER_UNDER)) return null;

  lines.sort((a, b) =>
    a.market === b.market ? a.line - b.line : a.market < b.market ? -1 : 1,
  );
  return {
    bookmaker,
    snapshotAt,
    oneXTwoOdds,
    fairOneXTwo: { home, draw, away },
    lines,
  };
}

/**
 * The prices the grid is fitted on: the first book of MARKET_GRID_BOOKMAKERS
 * with a complete 1X2 and at least one complete total-goals line among the
 * rows priced at or before `cutoff` (latest row per pick). `null` when no
 * book qualifies.
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
  oneXTwo: [number, number, number];
  lines: ReadonlyArray<{ market: Market; line: number; over: number }>;
};

function modelResiduals(
  lambdaHome: number,
  lambdaAway: number,
  targets: ModelTargets,
): { residuals: number[]; weights: number[] } {
  const { distHome, distAway } = buildPoissonDistributions(
    lambdaHome,
    lambdaAway,
    MARKET_GRID_MAX_GOALS,
  );
  let home = 0;
  let draw = 0;
  let away = 0;
  const total = new Array<number>(distHome.length + distAway.length).fill(0);
  for (let h = 0; h < distHome.length; h++) {
    for (let a = 0; a < distAway.length; a++) {
      const p = (distHome[h] ?? 0) * (distAway[a] ?? 0);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      total[h + a] = (total[h + a] ?? 0) + p;
    }
  }
  const over = (dist: readonly number[], line: number): number =>
    dist.reduce((sum, p, goals) => (goals > line ? sum + p : sum), 0);

  const residuals = [
    home - targets.oneXTwo[0],
    draw - targets.oneXTwo[1],
    away - targets.oneXTwo[2],
  ];
  const weights = [
    MARKET_GRID_ONE_X_TWO_WEIGHT,
    MARKET_GRID_ONE_X_TWO_WEIGHT,
    MARKET_GRID_ONE_X_TWO_WEIGHT,
  ];
  for (const target of targets.lines) {
    const dist =
      target.market === Market.TEAM_TOTAL_HOME
        ? distHome
        : target.market === Market.TEAM_TOTAL_AWAY
          ? distAway
          : total;
    residuals.push(over(dist, target.line) - target.over);
    weights.push(1);
  }
  return { residuals, weights };
}

function weightedLoss(
  x: readonly [number, number],
  targets: ModelTargets,
): number {
  const { residuals, weights } = modelResiduals(x[0], x[1], targets);
  return residuals.reduce((sum, r, i) => sum + (weights[i] ?? 0) * r * r, 0);
}

function clampLambda(value: number): number {
  return Math.min(
    MARKET_GRID_LAMBDA_MAX,
    Math.max(MARKET_GRID_LAMBDA_MIN, value),
  );
}

const STARTS: ReadonlyArray<readonly [number, number]> = [
  [1.4, 1.1],
  [1.0, 1.6],
  [2.0, 0.8],
];
const MAX_ITERATIONS = 100;
const STEP = 1e-6;
const TOLERANCE = 1e-12;

/** Levenberg-Marquardt on (λ home, λ away), numerical Jacobian, clamped. */
function levenbergMarquardt(
  start: readonly [number, number],
  targets: ModelTargets,
): { x: [number, number]; loss: number } {
  let x: [number, number] = [start[0], start[1]];
  let loss = weightedLoss(x, targets);
  let mu = 1e-3;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const { residuals, weights } = modelResiduals(x[0], x[1], targets);
    const jacobian = [0, 1].map((k) => {
      const up: [number, number] = [x[0], x[1]];
      const down: [number, number] = [x[0], x[1]];
      up[k] = (up[k] as number) + STEP;
      down[k] = (down[k] as number) - STEP;
      const rUp = modelResiduals(up[0], up[1], targets).residuals;
      const rDown = modelResiduals(down[0], down[1], targets).residuals;
      return rUp.map((r, i) => (r - (rDown[i] ?? 0)) / (2 * STEP));
    });
    const [j0, j1] = jacobian as [number[], number[]];
    let a00 = 0;
    let a01 = 0;
    let a11 = 0;
    let g0 = 0;
    let g1 = 0;
    residuals.forEach((r, i) => {
      const w = weights[i] ?? 0;
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
      const candidate: [number, number] = [
        clampLambda(x[0] + step0),
        clampLambda(x[1] + step1),
      ];
      const candidateLoss = weightedLoss(candidate, targets);
      if (candidateLoss < loss) {
        const gain = loss - candidateLoss;
        x = candidate;
        loss = candidateLoss;
        mu = Math.max(mu / 3, 1e-12);
        improved = true;
        if (gain < TOLERANCE) return { x, loss };
      } else {
        mu *= 4;
      }
    }
    if (!improved) break;
  }
  return { x, loss };
}

/**
 * λ home and λ away whose independent Poisson grid reproduces the fair
 * targets best (weighted least squares, three fixed starts, the best kept).
 * Deterministic: same targets → same λ.
 */
export function fitMarketGridLambdas(targets: FitTargets): MarketGridFit {
  const modelTargets: ModelTargets = {
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
  let best: { x: [number, number]; loss: number } | null = null;
  for (const start of STARTS) {
    const result = levenbergMarquardt(start, modelTargets);
    if (!best || result.loss < best.loss) best = result;
  }
  const solved = best as { x: [number, number]; loss: number };
  const totalWeight =
    3 * MARKET_GRID_ONE_X_TWO_WEIGHT + modelTargets.lines.length;
  return {
    lambdaHome: solved.x[0],
    lambdaAway: solved.x[1],
    rmse: Math.sqrt(solved.loss / totalWeight),
  };
}

/**
 * Every market probability from a fitted grid, in the statistics engine's
 * shape: the book's fair 1X2, everything else derived from the grid.
 */
export function marketGridProbabilities(
  fit: Pick<MarketGridFit, "lambdaHome" | "lambdaAway">,
  fairOneXTwo: ThreeWayProba,
): MatchProbabilities {
  return {
    ...fairOneXTwo,
    ...deriveMarketsFromPoisson({
      lambdaHome: fit.lambdaHome,
      lambdaAway: fit.lambdaAway,
      oneXTwo: fairOneXTwo,
      maxGoals: MARKET_GRID_MAX_GOALS,
    }),
  };
}

/**
 * The market grid of a fixture at `cutoff`, from its raw odds rows (any
 * book, any market: the rest is ignored). `unavailable` when no sharp book
 * prices a complete 1X2 and a total-goals line, or when its prices
 * contradict each other beyond MARKET_GRID_MAX_RMSE; the caller then keeps
 * its statistics engine.
 */
export function computeMarketGrid(
  rows: readonly RawOddsRow[],
  cutoff: Date,
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
  const fit = fitMarketGridLambdas({
    oneXTwo: quotes.fairOneXTwo,
    lines: quotes.lines,
  });
  if (!(fit.rmse <= MARKET_GRID_MAX_RMSE)) {
    return { status: "unavailable", reason: "fit_error", quotes, fit };
  }
  return {
    status: "ok",
    quotes,
    fit,
    probabilities: marketGridProbabilities(fit, quotes.fairOneXTwo),
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
