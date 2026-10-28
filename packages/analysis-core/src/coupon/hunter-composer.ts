import Decimal from "decimal.js";
import {
  marketProbability,
  priceOutcomeGroups,
} from "../pricing/market-probability";
import { operatorMarginOrTypical } from "../pricing/operator";
import type { ComboCandidate } from "./combo-generator";
import {
  HUNTER_BTTS_CLASS,
  HUNTER_DRAW_CLASS,
  HUNTER_SCORE_CLASS,
  type CouponClass,
} from "./coupon-classes";
import type { DoubleCandidate } from "./double-composer";

/**
 * Chasseurs (2026-10-28) : un produit par marché, une sélection par jour
 * dans la bande de cote du marché, ou l'abstention. Montrés aux joueurs
 * tout de suite (décision du 2026-10-28 : pas d'ombre), avec la fréquence
 * du marché, et mesurés jambe par jambe en direct. Jamais d'edge.
 *
 * BTTS et Nul (`composeHunterByMarket`) : tout ce qui est coté sur le marché
 * dans la bande, la marge payée chez 1xBet la plus basse d'abord (sa marge
 * typique du marché quand il ne cote pas tout le groupe), puis la
 * probabilité du marché. Le joueur paie 9,3 % en médiane chez 1xBet contre
 * 5,5 % chez les books de référence (MARGES-1XBET.md). Le coût est la seule chose qui persiste d'une période à l'autre
 * (r = +0,70) ; sur 116 jours, le nul « le plus probable » réalisait 6,4
 * points sous le marché (coût −24 %), le moins cher 1,1 (coût −7 %)
 * (docs/audits/2026-10-28/HUNTERS.md).
 *
 * Score exact (`composeScoreHunter`) : le score retenu par le moteur sur
 * chaque match (canal CORRECT_SCORE), dans la bande 5–12. La grille de
 * scores n'a pas de groupe d'issues fermé : la probabilité du marché retire
 * la marge typique de la grille (27 %), donc le classement revient à la cote
 * la plus basse.
 */

export type HunterSpec = {
  coupon: CouponClass;
  market: string;
  /** Issue chassée ; absente pour le score exact (tout score). */
  pick?: string;
};

export const BTTS_HUNTER: HunterSpec = {
  coupon: HUNTER_BTTS_CLASS,
  market: "BTTS",
  pick: "YES",
};

export const DRAW_HUNTER: HunterSpec = {
  coupon: HUNTER_DRAW_CLASS,
  market: "ONE_X_TWO",
  pick: "DRAW",
};

export const SCORE_HUNTER: HunterSpec = {
  coupon: HUNTER_SCORE_CLASS,
  market: "CORRECT_SCORE",
};

export type HunterLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  /** Cote de référence de la sélection. */
  odds: number;
  /** Probabilité du marché, marge retirée : la fréquence affichée. */
  probability: number;
  /** Marge payée chez 1xBet quand elle est connue. */
  operatorMargin?: number | null;
};

export type HunterComposition =
  | { outcome: "picked"; leg: HunterLeg; candidateCount: number }
  | {
      outcome: "abstained";
      reason: "no_candidate_in_band";
      candidateCount: number;
    };

const ABSTAINED: HunterComposition = {
  outcome: "abstained",
  reason: "no_candidate_in_band",
  candidateCount: 0,
};

function inBand(odds: number, spec: HunterSpec): boolean {
  return odds >= spec.coupon.minLegOdds && odds <= spec.coupon.maxLegOdds;
}

export function composeHunterByMarket(
  candidates: readonly DoubleCandidate[],
  spec: HunterSpec,
): HunterComposition {
  const legs = priceOutcomeGroups(candidates).filter(
    (leg) =>
      leg.market === spec.market &&
      leg.pick === spec.pick &&
      inBand(leg.playableOdds, spec),
  );
  const cost = (leg: (typeof legs)[number]) =>
    new Decimal(operatorMarginOrTypical(leg.market, leg.operatorMargin));
  let best: (typeof legs)[number] | null = null;
  for (const leg of legs) {
    if (
      !best ||
      cost(leg).lt(cost(best)) ||
      (cost(leg).eq(cost(best)) && leg.fair.gt(best.fair))
    ) {
      best = leg;
    }
  }
  if (!best) return ABSTAINED;
  return {
    outcome: "picked",
    leg: {
      fixtureId: best.fixtureId,
      market: best.market,
      pick: best.pick,
      odds: best.odds,
      probability: best.fair.toNumber(),
      operatorMargin: best.operatorMargin ?? null,
    },
    candidateCount: legs.length,
  };
}

/** Sélection du canal, avec la cote jouable quand elle est connue : la bande
 * se lit dessus, comme pour les autres chasseurs. */
export type ScoreHunterCandidate = ComboCandidate & { playableOdds?: number };

export function composeScoreHunter(
  candidates: readonly ScoreHunterCandidate[],
  spec: HunterSpec = SCORE_HUNTER,
): HunterComposition {
  const scored = candidates
    .filter(
      (c) => c.market === spec.market && inBand(c.playableOdds ?? c.odds, spec),
    )
    .flatMap((c) => {
      const probability = marketProbability({
        odds: c.odds,
        market: spec.market,
      });
      return probability === null
        ? []
        : [{ candidate: c, probability: new Decimal(probability) }];
    });
  let best: (typeof scored)[number] | null = null;
  for (const row of scored) {
    if (
      !best ||
      row.probability.gt(best.probability) ||
      (row.probability.eq(best.probability) &&
        row.candidate.fixtureId < best.candidate.fixtureId)
    ) {
      best = row;
    }
  }
  if (!best) return ABSTAINED;
  return {
    outcome: "picked",
    leg: {
      fixtureId: best.candidate.fixtureId,
      market: best.candidate.market,
      pick: best.candidate.pick,
      odds: best.candidate.odds,
      probability: best.probability.toNumber(),
    },
    candidateCount: scored.length,
  };
}
