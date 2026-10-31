import Decimal from "decimal.js";
import type { Market } from "../types";
import type { PricedOutcome } from "./closing-line-value";
import type { PricedRow } from "./market-probability";
import { outcomeGroup } from "./outcome-groups";

/** Precision of the solve (on Σ p − 1): far below the fourth decimal stored. */
const SHIN_TOLERANCE = 1e-13;
const SHIN_MAX_ITERATIONS = 100;

/**
 * Fair probabilities of a complete, exclusive group of outcomes, by Shin's
 * method (Shin 1993; Štrumbelj 2014): the bookmaker's margin is read as
 * protection against a share `z` of informed money, which weighs on the
 * outsiders more than on the favourite.
 *
 *   p_i(z) = ( sqrt(z² + 4 (1 − z) π_i² / B) − z ) / ( 2 (1 − z) )
 *
 * with π_i = 1 / odds_i and B = Σ π_i, z chosen so that Σ p_i = 1.
 *
 * Never the proportional removal (π_i / B), which inflates the outsiders:
 * −23 % measured on the long odds (docs/refonte-ui/07 § 4,
 * docs/audits/2026-10-29/ACCUMULATEUR.md).
 *
 * `null` when the group cannot be priced: fewer than two outcomes, an odds
 * of 1 or below, or no margin at all (B ≤ 1, where z has no meaning).
 * Groups whose outcomes overlap (double chance) are not for this function.
 */
export function shinProbabilities(
  outcomes: readonly PricedOutcome[],
): Map<string, Decimal> | null {
  if (outcomes.length < 2) return null;
  if (outcomes.some((o) => o.odds.lte(1))) return null;
  const implied = outcomes.map((o) => new Decimal(1).div(o.odds));
  const booksum = implied.reduce((acc, p) => acc.plus(p), new Decimal(0));
  if (booksum.lte(1)) return null;

  // 4 π_i² / B does not depend on z: computed once.
  const weights = implied.map((p) => p.pow(2).times(4).div(booksum));
  const z = solveZ(weights.map((w) => w.toNumber()));
  if (z === null) return null;

  // The probabilities themselves in decimal.js, at the z found.
  const zd = new Decimal(z);
  const zSquared = zd.pow(2);
  const rest = new Decimal(1).minus(zd);
  const probabilities = weights.map((w) =>
    zSquared.plus(rest.times(w)).sqrt().minus(zd).div(rest.times(2)),
  );
  // The solve leaves a residue near 1e-13: renormalised, the group sums to 1.
  const total = probabilities.reduce((acc, p) => acc.plus(p), new Decimal(0));
  return new Map(
    outcomes.map((o, i) => [o.pick, (probabilities[i] as Decimal).div(total)]),
  );
}

/**
 * z such that Σ p_i(z) = 1, by regula falsi (Illinois variant). In floating
 * point on purpose: z is a solver variable, never shown nor stored, and the
 * decimal.js solve cost 0,4 ms a group, a second on a page of « Matchs »;
 * the probabilities are then computed and renormalised in decimal.js. Σ p_i
 * falls as z grows (√B > 1 at z = 0), so [0, 0,99] brackets the root.
 */
function solveZ(weights: readonly number[]): number | null {
  const excess = (z: number): number =>
    weights.reduce(
      (acc, w) => acc + (Math.sqrt(z * z + (1 - z) * w) - z) / (2 * (1 - z)),
      0,
    ) - 1;
  let a = 0;
  let fa = excess(a);
  let b = 0.99;
  let fb = excess(b);
  if (fb > 0) return null;
  let z = b;
  for (let i = 0; i < SHIN_MAX_ITERATIONS; i += 1) {
    z = b - (fb * (b - a)) / (fb - fa);
    const fz = excess(z);
    if (Math.abs(fz) < SHIN_TOLERANCE) break;
    if (fz * fb < 0) {
      a = b;
      fa = fb;
    } else {
      fa /= 2;
    }
    b = z;
    fb = fz;
  }
  return z;
}

/**
 * Double chance from the 1X2 group of the same book and snapshot: its three
 * outcomes overlap (each result is covered twice), so Shin applies to 1X2
 * and each pair adds up. `null` without a complete 1X2.
 */
export function shinDoubleChance(
  oneXTwo: readonly PricedOutcome[],
): Map<string, Decimal> | null {
  const fair = shinProbabilities(oneXTwo);
  const home = fair?.get("HOME");
  const draw = fair?.get("DRAW");
  const away = fair?.get("AWAY");
  if (!home || !draw || !away) return null;
  return new Map([
    ["1X", home.plus(draw)],
    ["X2", draw.plus(away)],
    ["12", home.plus(away)],
  ]);
}

/**
 * Shin's fair probability of every row whose outcome group is complete in
 * `rows` (same fixture, same market, all outcomes present): the rows must
 * come from one book and one snapshot, never mixed. Double chance is read
 * from the 1X2 rows of the same fixture. A row of an incomplete group is
 * left out: a frequency on part of a group would be overstated.
 */
export function shinOutcomeGroups<T extends PricedRow>(
  rows: readonly T[],
): (T & { fair: Decimal })[] {
  const groups = new Map<string, { picks: readonly string[]; rows: T[] }>();
  for (const row of rows) {
    const group = outcomeGroup(row.market as Market, row.pick);
    if (!group) continue;
    const key = `${row.fixtureId}|${row.market}|${group.picks.join(",")}`;
    const entry = groups.get(key) ?? { picks: group.picks, rows: [] };
    entry.rows.push(row);
    groups.set(key, entry);
  }

  const priced: (T & { fair: Decimal })[] = [];
  for (const { picks, rows: members } of groups.values()) {
    const [first] = members;
    if (!first) continue;
    const fair =
      first.market === "DOUBLE_CHANCE"
        ? shinDoubleChance(oneXTwoOf(rows, first.fixtureId))
        : completeGroup(members, picks) &&
          shinProbabilities(outcomesOf(members));
    if (!fair) continue;
    for (const row of members) {
      const p = fair.get(row.pick);
      if (p) priced.push({ ...row, fair: p });
    }
  }
  return priced;
}

function completeGroup(
  members: readonly PricedRow[],
  picks: readonly string[],
): boolean {
  const present = new Set(members.map((row) => row.pick));
  return picks.every((pick) => present.has(pick));
}

function outcomesOf(members: readonly PricedRow[]): PricedOutcome[] {
  return members.map((row) => ({
    pick: row.pick,
    odds: new Decimal(row.odds),
  }));
}

function oneXTwoOf(
  rows: readonly PricedRow[],
  fixtureId: string,
): PricedOutcome[] {
  return outcomesOf(
    rows.filter(
      (row) => row.fixtureId === fixtureId && row.market === "ONE_X_TWO",
    ),
  );
}
