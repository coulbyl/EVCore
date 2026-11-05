import Decimal from "decimal.js";
import { COMBO_COUPON_CLASS } from "./coupon-classes";

/**
 * La lecture d'un match (« Notre lecture », `readingOf` côté backend) telle
 * que le combiné du jour la reçoit : le pari, sa cote chez 1xBet et la
 * fréquence sans marge du marché sur ce même relevé (la chance affichée).
 */
export type ReadingLeg = {
  fixtureId: string;
  competition: string;
  market: string;
  pick: string;
  /** Cote 1xBet de la lecture. */
  odds: number;
  /** Fréquence du marché sans marge (Shin, 1xBet), dans [0, 1]. */
  chance: number;
};

export type ReadingComboConfig = {
  legs: number;
  minLegOdds: number;
  maxLegOdds: number;
  minCombinedOdds: number;
  maxCombinedOdds: number;
};

/** Règle B2 de docs/audits/2026-11-05/COMBINE-ET-LECTURE.md § 3. */
export const READING_COMBO_CONFIG: ReadingComboConfig = {
  legs: COMBO_COUPON_CLASS.maxLegs,
  minLegOdds: COMBO_COUPON_CLASS.minLegOdds,
  maxLegOdds: COMBO_COUPON_CLASS.maxLegOdds,
  minCombinedOdds: 1.8,
  maxCombinedOdds: 2.6,
};

export type ReadingComboSelection =
  | { outcome: "picked"; legs: ReadingLeg[]; candidateCount: number }
  | {
      outcome: "abstained";
      reason: "not_enough_readings" | "no_combination_in_band";
      candidateCount: number;
    };

/**
 * Le combiné du jour à partir des lectures (COMBO_COUPON_CLASS) : les
 * lectures cotées dans la bande, une par championnat (sa plus forte
 * fréquence du marché), classées par fréquence décroissante puis cote
 * croissante ; puis la première combinaison dans cet ordre dont la cote
 * combinée (Decimal) tombe dans la bande. Un match sans lecture n'est
 * jamais dans `readings` : il est ignoré, jamais remplacé par un autre pari.
 */
export function composeReadingCombo(
  readings: readonly ReadingLeg[],
  config: ReadingComboConfig = READING_COMBO_CONFIG,
): ReadingComboSelection {
  const ordered = readings
    .filter(
      (r) =>
        Number.isFinite(r.odds) &&
        r.odds >= config.minLegOdds &&
        r.odds <= config.maxLegOdds,
    )
    .sort(
      (a, b) =>
        b.chance - a.chance ||
        a.odds - b.odds ||
        a.fixtureId.localeCompare(b.fixtureId),
    );
  const perCompetition = new Map<string, ReadingLeg>();
  for (const r of ordered) {
    if (!perCompetition.has(r.competition)) perCompetition.set(r.competition, r);
  }
  const pool = [...perCompetition.values()];
  if (pool.length < config.legs) {
    return {
      outcome: "abstained",
      reason: "not_enough_readings",
      candidateCount: pool.length,
    };
  }
  const legs = firstCombination({ pool, config, start: 0, chosen: [] });
  return legs
    ? { outcome: "picked", legs, candidateCount: pool.length }
    : {
        outcome: "abstained",
        reason: "no_combination_in_band",
        candidateCount: pool.length,
      };
}

/** La première combinaison de `config.legs` lectures, dans l'ordre du
 * vivier, dont la cote combinée est dans la bande. */
function firstCombination(input: {
  pool: readonly ReadingLeg[];
  config: ReadingComboConfig;
  start: number;
  chosen: readonly ReadingLeg[];
}): ReadingLeg[] | null {
  const { pool, config, chosen } = input;
  if (chosen.length === config.legs) {
    const combined = chosen.reduce(
      (acc, leg) => acc.times(leg.odds),
      new Decimal(1),
    );
    return combined.gte(config.minCombinedOdds) &&
      combined.lte(config.maxCombinedOdds)
      ? [...chosen]
      : null;
  }
  for (let i = input.start; i < pool.length; i++) {
    const leg = pool[i];
    if (!leg) continue;
    const found = firstCombination({
      pool,
      config,
      start: i + 1,
      chosen: [...chosen, leg],
    });
    if (found) return found;
  }
  return null;
}
