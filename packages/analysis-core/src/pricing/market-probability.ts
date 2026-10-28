import Decimal from "decimal.js";
import type { Market } from "../types";
import { outcomeGroup } from "./outcome-groups";
import { fairProbabilities } from "./closing-line-value";

/**
 * Marge typique de chaque marché : médiane mesurée le 2026-10-28 sur 458 611
 * sélections réglées, marge retirée sur le groupe d'issues complet
 * (docs/audits/2026-10-28/SELECTIONS-LAISSEES.md, scripts/prep.py). Sert
 * quand la marge payée n'est pas enregistrée sur la sélection (environ 30 %
 * des sélections récentes, toutes celles d'avant le 2026-10-11).
 */
export const TYPICAL_MARKET_MARGIN: Readonly<Record<string, number>> = {
  OVER_UNDER: 0.049,
  ONE_X_TWO: 0.05,
  TEAM_TOTAL_HOME: 0.052,
  TEAM_TOTAL_AWAY: 0.052,
  FIRST_HALF_WINNER: 0.055,
  OVER_UNDER_HT: 0.06,
  DOUBLE_CHANCE: 0.062,
  CLEAN_SHEET_HOME: 0.069,
  CLEAN_SHEET_AWAY: 0.067,
  DRAW_NO_BET: 0.072,
  BTTS: 0.075,
  WIN_TO_NIL_HOME: 0.087,
  WIN_TO_NIL_AWAY: 0.088,
  RESULT_BTTS: 0.146,
  RESULT_TOTAL_GOALS: 0.158,
  HALF_TIME_FULL_TIME: 0.205,
};

/** Marchés sans groupe d'issues propre (gagner une mi-temps…) ou inconnus. */
export const DEFAULT_MARKET_MARGIN = 0.06;

/**
 * Probabilité d'un choix selon le marché : 1 / cote, marge du bookmaker
 * retirée — la marge payée sur le groupe d'issues quand elle est connue,
 * sinon la marge typique du marché.
 *
 * C'est le chiffre affiché au joueur (« environ 7 fois sur 10 ») depuis le
 * 2026-10-28 : sur nos sélections affichées depuis juillet, la probabilité
 * du moteur était optimiste de 4 à 8 points, celle du marché tombait à un ou
 * deux points près (docs/audits/2026-10-28/SELECTIONS-LAISSEES.md).
 */
export function marketProbability(input: {
  odds: number | null;
  market: string;
  marginPaid?: number | null;
}): number | null {
  if (input.odds === null || !(input.odds > 1)) return null;
  const margin =
    input.marginPaid ??
    TYPICAL_MARKET_MARGIN[input.market] ??
    DEFAULT_MARKET_MARGIN;
  const probability = new Decimal(1)
    .div(input.odds)
    .div(new Decimal(1).plus(margin));
  return Decimal.min(probability, 1).toDecimalPlaces(4).toNumber();
}

export type PricedRow = {
  fixtureId: string;
  market: string;
  pick: string;
  odds: number;
};

/**
 * Probabilité du marché exacte pour chaque choix dont le groupe d'issues est
 * complet (tous les choix qui se partagent la mise sont cotés), avec la marge
 * du groupe. Un choix sans groupe propre (gagner une mi-temps) ou à groupe
 * incomplet est absent du résultat : une probabilité sur groupe incomplet
 * serait surévaluée.
 */
export function priceOutcomeGroups<T extends PricedRow>(
  rows: readonly T[],
): (T & { fair: Decimal; margin: Decimal })[] {
  const groups = new Map<
    string,
    { outcomeTotal: number; picks: readonly string[]; rows: T[] }
  >();
  for (const row of rows) {
    const group = outcomeGroup(row.market as Market, row.pick);
    if (!group) continue;
    const key = `${row.fixtureId}|${row.market}|${group.picks.join(",")}`;
    const entry = groups.get(key) ?? {
      outcomeTotal: group.outcomeTotal,
      picks: group.picks,
      rows: [],
    };
    entry.rows.push(row);
    groups.set(key, entry);
  }

  const priced: (T & { fair: Decimal; margin: Decimal })[] = [];
  for (const { outcomeTotal, picks, rows: members } of groups.values()) {
    const byPick = new Map(members.map((r) => [r.pick, r]));
    if (!picks.every((pick) => byPick.has(pick))) continue;
    const outcomes = picks.map((pick) => ({
      pick,
      odds: new Decimal((byPick.get(pick) as T).odds),
    }));
    const fair = fairProbabilities(outcomes, outcomeTotal);
    if (!fair) continue;
    const margin = outcomes
      .reduce((acc, o) => acc.plus(new Decimal(1).div(o.odds)), new Decimal(0))
      .div(outcomeTotal)
      .minus(1);
    for (const row of byPick.values()) {
      const p = fair.get(row.pick);
      if (p) priced.push({ ...row, fair: p, margin });
    }
  }
  return priced;
}
