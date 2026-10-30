import Decimal from "decimal.js";
import {
  marketProbability,
  priceOutcomeGroups,
} from "../pricing/market-probability";
import { operatorMarginOrTypical } from "../pricing/operator";
import { shinProbabilities } from "../pricing/shin";
import type { ComboCandidate } from "./combo-generator";
import {
  HUNTER_BTTS_CLASS,
  HUNTER_DRAW_CLASS,
  HUNTER_SCORE_CLASS,
  HUNTER_CORNERS_CLASS,
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
  /** Ligne des marchés qui la portent en colonne (corners). */
  line?: number | null;
  /** Cote 1xBet quand le chasseur la connaît déjà (corners). */
  operatorOdds?: number | null;
  /**
   * Fréquence sans marge de Shin sur le groupe 1xBet de cette cote (corners),
   * stockée avec elle : la chance affichée au-dessus de 1,80.
   */
  operatorFairProbability?: number | null;
};

export type HunterComposition =
  | { outcome: "picked"; leg: HunterLeg; candidateCount: number }
  | {
      outcome: "abstained";
      reason:
        | "no_candidate_in_band"
        | "no_reliable_competition"
        | "no_operator_price";
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

export const CORNERS_HUNTER: HunterSpec = {
  coupon: HUNTER_CORNERS_CLASS,
  market: "CORNERS",
};

/** Un prix relevé sur une ligne de corners (plus ou moins), un book. */
export type CornersQuote = {
  fixtureId: string;
  line: number;
  pick: "OVER" | "UNDER";
  bookmaker: string;
  odds: number;
  /** Instant du relevé : une paire ne se lit que sur un même relevé. */
  snapshotAt: Date;
};

/** Un côté d'une ligne, au prix 1xBet, avec sa marge et la fréquence du marché. */
export type CornersSide = {
  fixtureId: string;
  line: number;
  pick: "OVER" | "UNDER";
  /** Cote 1xBet du côté. */
  odds: number;
  /** Marge 1xBet de la paire (somme des deux implicites − 1). */
  margin: Decimal;
  /** Fréquence du marché sans marge : Pinnacle quand il cote la ligne, sinon 1xBet. */
  fair: Decimal;
  /** Fréquence de Shin sur la paire 1xBet, celle qu'on affiche avec sa cote. */
  operatorFair: Decimal | null;
};

function pairsOf(
  quotes: readonly CornersQuote[],
  bookmaker: string,
): Map<string, { over: CornersQuote; under: CornersQuote }> {
  const pairs = new Map<
    string,
    { over?: CornersQuote; under?: CornersQuote }
  >();
  for (const quote of quotes) {
    if (quote.bookmaker !== bookmaker) continue;
    const key = `${quote.fixtureId}|${quote.line}`;
    const pair = pairs.get(key) ?? {};
    pair[quote.pick === "OVER" ? "over" : "under"] = quote;
    pairs.set(key, pair);
  }
  const complete = new Map<
    string,
    { over: CornersQuote; under: CornersQuote }
  >();
  for (const [key, pair] of pairs) {
    if (
      pair.over &&
      pair.under &&
      pair.over.snapshotAt.getTime() === pair.under.snapshotAt.getTime()
    ) {
      complete.set(key, { over: pair.over, under: pair.under });
    }
  }
  return complete;
}

/**
 * Les deux côtés de chaque ligne de corners cotée en entier par 1xBet sur un
 * même relevé, lignes en ,5 seulement (pas de remboursement) : marge 1xBet de
 * la paire et fréquence du marché sans marge, en Decimal.
 */
export function priceCornersSides(
  quotes: readonly CornersQuote[],
  operator: string,
  reference: string,
): CornersSide[] {
  const operatorPairs = pairsOf(quotes, operator);
  const referencePairs = pairsOf(quotes, reference);
  const sides: CornersSide[] = [];
  for (const [key, pair] of operatorPairs) {
    if (!new Decimal(pair.over.line).mod(1).eq(0.5)) continue;
    const over = new Decimal(1).dividedBy(pair.over.odds);
    const under = new Decimal(1).dividedBy(pair.under.odds);
    const margin = over.plus(under).minus(1);
    const ref = referencePairs.get(key);
    const refOver = ref ? new Decimal(1).dividedBy(ref.over.odds) : over;
    const refUnder = ref ? new Decimal(1).dividedBy(ref.under.odds) : under;
    const fairOver = refOver.dividedBy(refOver.plus(refUnder));
    const operatorFair = shinProbabilities([
      { pick: "OVER", odds: new Decimal(pair.over.odds) },
      { pick: "UNDER", odds: new Decimal(pair.under.odds) },
    ]);
    for (const side of [pair.over, pair.under]) {
      sides.push({
        fixtureId: side.fixtureId,
        line: side.line,
        pick: side.pick,
        odds: side.odds,
        margin,
        fair: side.pick === "OVER" ? fairOver : new Decimal(1).minus(fairOver),
        operatorFair: operatorFair?.get(side.pick) ?? null,
      });
    }
  }
  return sides;
}

/**
 * Chasseur Corners : parmi les côtés dans la bande (1,70–2,10 au prix
 * 1xBet), la marge 1xBet la plus basse, puis la fréquence du marché la plus
 * haute. Le marché est calibré : on choisit le moins cher, pas « le plus
 * probable ».
 */
export function composeCornersHunter(
  sides: readonly CornersSide[],
  spec: HunterSpec = CORNERS_HUNTER,
): HunterComposition {
  const inside = sides.filter((side) => inBand(side.odds, spec));
  let best: CornersSide | null = null;
  for (const side of inside) {
    if (
      !best ||
      side.margin.lt(best.margin) ||
      (side.margin.eq(best.margin) && side.fair.gt(best.fair))
    ) {
      best = side;
    }
  }
  if (!best) return { ...ABSTAINED, candidateCount: inside.length };
  return {
    outcome: "picked",
    leg: {
      fixtureId: best.fixtureId,
      market: spec.market,
      pick: best.pick,
      line: best.line,
      odds: best.odds,
      operatorOdds: best.odds,
      probability: best.fair.toNumber(),
      operatorMargin: best.margin.toNumber(),
      operatorFairProbability:
        best.operatorFair?.toDecimalPlaces(4).toNumber() ?? null,
    },
    candidateCount: inside.length,
  };
}
