import Decimal from "decimal.js";
import { shinProbabilities } from "../pricing/shin";

/**
 * Count markets priced from a sharp book's ladder (sub-model B of the ML v2
 * programme, docs/audits/2026-11-05/ML3-CORNERS-CARTONS.md): the match
 * total of corners (or cards) is a negative binomial of mean μ and size r
 * (Poisson when r is null). μ is fitted on the book's lines, margin removed
 * by Shin; any line, quoted or not, is then read off the same distribution.
 *
 * Arithmetic in number inside the solve (like the grid's fit), Decimal at
 * the boundary.
 */

/** One complete line of the ladder: P(over | no push), margin removed. */
export type CountLineFair = { line: number; fairOver: Decimal };

/** One price of an over/under count line at one book. */
export type CountQuote = {
  line: number;
  pick: "OVER" | "UNDER";
  odds: number;
  /** A pair is read only on one quote: both sides at the same instant. */
  snapshotAt: Date;
};

/** Largest count summed: far past any corners or cards total. */
const MAX_COUNT = 80;
const MEAN_MIN = 0.2;
const MEAN_MAX = 40;
const GOLDEN_ITERATIONS = 80;

function pmf(mean: number, size: number | null): number[] {
  const out = new Array<number>(MAX_COUNT + 1);
  if (size === null) {
    out[0] = Math.exp(-mean);
    for (let k = 1; k <= MAX_COUNT; k++) {
      out[k] = ((out[k - 1] as number) * mean) / k;
    }
    return out;
  }
  const q = mean / (size + mean);
  out[0] = Math.pow(size / (size + mean), size);
  for (let k = 1; k <= MAX_COUNT; k++) {
    out[k] = (((out[k - 1] as number) * (k - 1 + size)) / k) * q;
  }
  return out;
}

function sides(
  probs: readonly number[],
  line: number,
): { over: number; under: number; push: number } {
  let under = 0;
  let push = 0;
  for (let k = 0; k <= MAX_COUNT; k++) {
    const p = probs[k] as number;
    if (k < line) under += p;
    else if (k === line) push += p;
  }
  return { over: Math.max(0, 1 - under - push), under, push };
}

function conditionalOver(mean: number, size: number | null, line: number) {
  const s = sides(pmf(mean, size), line);
  const decided = s.over + s.under;
  return decided > 0 ? s.over / decided : 0;
}

/**
 * Over, under and push of one line (push only on a whole line) for a total
 * of mean `mean` and size `size` (null: Poisson).
 */
export function countLineProbabilities(input: {
  mean: number;
  size: number | null;
  line: number;
}): { over: Decimal; under: Decimal; push: Decimal } {
  const s = sides(pmf(input.mean, input.size), input.line);
  return {
    over: new Decimal(s.over),
    under: new Decimal(s.under),
    push: new Decimal(s.push),
  };
}

/** P(over | no push) of one line: what a book's pair prices. */
export function countConditionalOver(input: {
  mean: number;
  size: number | null;
  line: number;
}): Decimal {
  return new Decimal(conditionalOver(input.mean, input.size, input.line));
}

/**
 * μ whose ladder is nearest the book's (least squares on P(over | no push)
 * across lines, golden section: each line's over rises with μ). Null when
 * no line is given, or when the root mean square gap exceeds `maxRmse`
 * (a ladder this distribution cannot carry is refused, never forced).
 */
export function fitCountMean(input: {
  lines: readonly CountLineFair[];
  size: number | null;
  maxRmse: number;
}): { mean: number; rmse: number } | null {
  const lines = input.lines.map((l) => ({
    line: l.line,
    fair: l.fairOver.toNumber(),
  }));
  if (lines.length === 0) return null;
  const loss = (mean: number) =>
    lines.reduce((acc, l) => {
      const d = conditionalOver(mean, input.size, l.line) - l.fair;
      return acc + d * d;
    }, 0);
  const phi = (Math.sqrt(5) - 1) / 2;
  let lo = MEAN_MIN;
  let hi = MEAN_MAX;
  let a = hi - phi * (hi - lo);
  let b = lo + phi * (hi - lo);
  let fa = loss(a);
  let fb = loss(b);
  for (let i = 0; i < GOLDEN_ITERATIONS; i++) {
    if (fa < fb) {
      hi = b;
      b = a;
      fb = fa;
      a = hi - phi * (hi - lo);
      fa = loss(a);
    } else {
      lo = a;
      a = b;
      fa = fb;
      b = lo + phi * (hi - lo);
      fb = loss(b);
    }
  }
  const mean = (lo + hi) / 2;
  const rmse = Math.sqrt(loss(mean) / lines.length);
  if (rmse > input.maxRmse) return null;
  return { mean, rmse };
}

/**
 * One book's ladder at its latest quote: per line, the latest pair whose
 * two sides share a snapshot, kept only within `maxGapMinutes` of the
 * book's latest pair (older lines are another quote), margin removed by
 * Shin on the pair.
 */
export function selectCountLadder(
  quotes: readonly CountQuote[],
  maxGapMinutes: number,
): CountLineFair[] {
  const byLine = new Map<
    number,
    Map<number, { over?: CountQuote; under?: CountQuote }>
  >();
  for (const q of quotes) {
    const atLine = byLine.get(q.line) ?? new Map();
    const t = q.snapshotAt.getTime();
    const pair = atLine.get(t) ?? {};
    if (q.pick === "OVER") pair.over = q;
    else pair.under = q;
    atLine.set(t, pair);
    byLine.set(q.line, atLine);
  }
  const latest: Array<{
    line: number;
    at: number;
    over: number;
    under: number;
  }> = [];
  for (const [line, pairs] of byLine) {
    let best: { at: number; over: number; under: number } | null = null;
    for (const [at, pair] of pairs) {
      if (!pair.over || !pair.under) continue;
      if (!best || at > best.at) {
        best = { at, over: pair.over.odds, under: pair.under.odds };
      }
    }
    if (best) latest.push({ line, ...best });
  }
  if (latest.length === 0) return [];
  const newest = Math.max(...latest.map((l) => l.at));
  const out: CountLineFair[] = [];
  for (const l of latest) {
    if (newest - l.at > maxGapMinutes * 60_000) continue;
    const fair = shinProbabilities([
      { pick: "OVER", odds: new Decimal(l.over) },
      { pick: "UNDER", odds: new Decimal(l.under) },
    ])?.get("OVER");
    if (fair) out.push({ line: l.line, fairOver: fair });
  }
  return out.sort((x, y) => x.line - y.line);
}
