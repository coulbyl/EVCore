import Decimal from "decimal.js";
import { AI_COMBO_COUPON_CLASS, type CouponClass } from "./coupon-classes";

/** Un avis joué par l'IA, au prix 1xBet. */
export type AiComboCandidate = {
  fixtureId: string;
  competition: string;
  market: string;
  pick: string;
  /** Cote 1xBet de l'avis. */
  operatorOdds: number;
  /** Marge payée chez 1xBet sur son groupe, quand il est coté entier. */
  operatorMargin: number | null;
  /** Fréquence du marché sans marge : la chance affichée. */
  probability: number;
};

export type AiComboComposition =
  | {
      outcome: "composed";
      legs: AiComboCandidate[];
      combinedOdds: number;
      /** Produit des fréquences du marché. */
      jointProbability: number;
      candidateCount: number;
    }
  | {
      outcome: "abstained";
      reason: "no_ai_play_in_band" | "combined_odds_out_of_band";
      candidateCount: number;
    };

/**
 * Le Combiné IA (AI_COMBO_COUPON_CLASS) : les avis joués par l'IA dans la
 * bande, un par championnat, la marge 1xBet la plus basse d'abord (le coût
 * est la seule chose qui persiste, r = +0,70), puis la fréquence du marché ;
 * chaque avis entre tant que la cote combinée reste sous le plafond, jusqu'à
 * atteindre le plancher ou le nombre de jambes. Sinon, pas de combiné.
 */
export function composeAiCombo(
  candidates: readonly AiComboCandidate[],
  couponClass: CouponClass = AI_COMBO_COUPON_CLASS,
): AiComboComposition {
  const inBand = candidates.filter(
    (c) =>
      c.operatorOdds >= couponClass.minLegOdds &&
      c.operatorOdds <= couponClass.maxLegOdds,
  );
  const candidateCount = inBand.length;
  if (candidateCount === 0) {
    return {
      outcome: "abstained",
      reason: "no_ai_play_in_band",
      candidateCount,
    };
  }
  const ranked = [...inBand].sort(
    (a, b) =>
      (a.operatorMargin ?? Number.POSITIVE_INFINITY) -
        (b.operatorMargin ?? Number.POSITIVE_INFINITY) ||
      b.probability - a.probability,
  );
  const legs: AiComboCandidate[] = [];
  const competitions = new Set<string>();
  const fixtures = new Set<string>();
  let combined = new Decimal(1);
  for (const candidate of ranked) {
    if (legs.length >= couponClass.maxLegs) break;
    if (combined.gte(couponClass.targetOddsMin)) break;
    if (competitions.has(candidate.competition)) continue;
    if (fixtures.has(candidate.fixtureId)) continue;
    const next = combined.times(candidate.operatorOdds);
    if (next.gt(couponClass.targetOddsMax)) continue;
    legs.push(candidate);
    competitions.add(candidate.competition);
    fixtures.add(candidate.fixtureId);
    combined = next;
  }
  if (combined.lt(couponClass.targetOddsMin)) {
    return {
      outcome: "abstained",
      reason: "combined_odds_out_of_band",
      candidateCount,
    };
  }
  return {
    outcome: "composed",
    legs,
    combinedOdds: combined.toDecimalPlaces(3).toNumber(),
    jointProbability: legs
      .reduce((p, leg) => p.times(leg.probability), new Decimal(1))
      .toDecimalPlaces(6)
      .toNumber(),
    candidateCount,
  };
}
