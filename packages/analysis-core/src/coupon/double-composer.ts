import Decimal from "decimal.js";
import { priceOutcomeGroups } from "../pricing/market-probability";
import { operatorMarginOrTypical } from "../pricing/operator";
import { DOUBLE_COUPON_CLASS, type CouponClass } from "./coupon-classes";
import { POOL_EXCLUDED_MARKETS } from "./pool-eligibility";

/**
 * Compositeur du coupon cote 2 (DOUBLE_COUPON_CLASS).
 *
 * Le vivier est tout ce que le moteur a envisagé et qui est coté, retenu ou
 * rejeté : à prix égal, ses sélections ne passent pas plus souvent que ce
 * qu'il écarte (docs/audits/2026-10-28/SELECTIONS-LAISSEES.md). Le classement
 * est la probabilité du marché sans marge — à cote combinée égale, la
 * combinaison la plus probable selon le marché est celle qui paie le moins
 * de marge. Aucune sortie du moteur n'intervient.
 */

export type DoubleCandidate = {
  fixtureId: string;
  market: string;
  pick: string;
  /** Cote d'analyse (livres de référence) : sert à retirer la marge. */
  odds: number;
  /** Cote chez le book du joueur, sinon la plus basse relevée. */
  playableOdds: number;
  /**
   * Marge payée chez le book du joueur sur le groupe complet ; null s'il ne
   * le cote pas en entier (on suppose alors sa marge typique du marché).
   */
  operatorMargin?: number | null;
};

export type DoubleLeg = DoubleCandidate & {
  /** Probabilité du marché, marge retirée sur le groupe d'issues complet. */
  fair: Decimal;
  /** Marge du groupe d'issues : somme des probabilités implicites − 1. */
  margin: Decimal;
};

export type DoubleComposition =
  | {
      outcome: "composed";
      legs: DoubleLeg[];
      /** Cote combinée chez le book du joueur. */
      playableCombinedOdds: Decimal;
      /** Probabilité annoncée : produit des probabilités du marché. */
      probability: Decimal;
      candidateCount: number;
    }
  | {
      outcome: "abstained";
      reason: "no_priced_candidate" | "no_combination_in_window";
      candidateCount: number;
    };

/**
 * Probabilité du marché pour chaque candidat dont le groupe d'issues est
 * complet chez la référence (priceOutcomeGroups).
 */
export function priceDoubleCandidates(
  candidates: readonly DoubleCandidate[],
): DoubleLeg[] {
  return priceOutcomeGroups(candidates);
}

type Combo = { legs: DoubleLeg[]; score: Decimal; margin: Decimal };

function better(candidate: Combo, best: Combo | null): boolean {
  if (!best) return true;
  const cmp = candidate.score.comparedTo(best.score);
  return cmp > 0 || (cmp === 0 && candidate.margin.lt(best.margin));
}

// Produit de cotes en Decimal, comme toute arithmétique de cotes (CLAUDE.md),
// pour que les bornes 2 et 3 se lisent exactement.
function inWindow(legs: readonly DoubleLeg[], bounds: CouponClass): boolean {
  const odds = legs.reduce(
    (acc, leg) => acc.times(leg.playableOdds),
    new Decimal(1),
  );
  return odds.gte(bounds.targetOddsMin) && odds.lte(bounds.targetOddsMax);
}

function distinctFixtures(legs: readonly DoubleLeg[]): boolean {
  return new Set(legs.map((leg) => leg.fixtureId)).size === legs.length;
}

/** Coût réel d'une jambe : la marge payée chez 1xBet (2026-10-29). */
function costOf(leg: DoubleLeg): Decimal {
  return new Decimal(operatorMarginOrTypical(leg.market, leg.operatorMargin));
}

function comboOf(legs: DoubleLeg[]): Combo {
  return {
    legs,
    score: legs.reduce((acc, leg) => acc.times(leg.fair), new Decimal(1)),
    // Départage : la marge payée chez 1xBet, plus celle de la référence,
    // qui sous-estime ce que paie le joueur (MARGES-1XBET.md).
    margin: legs.reduce((acc, leg) => acc.plus(costOf(leg)), new Decimal(0)),
  };
}

/**
 * Par match, garde le meilleur candidat de chaque dixième de cote : assez pour
 * trouver la meilleure combinaison (elle ne prend qu'une jambe par match),
 * et le nombre de paires reste petit.
 */
function shortlist(legs: readonly DoubleLeg[]): DoubleLeg[] {
  const best = new Map<string, DoubleLeg>();
  for (const leg of legs) {
    const key = `${leg.fixtureId}|${Math.floor(leg.playableOdds * 10)}`;
    const held = best.get(key);
    if (
      !held ||
      leg.fair.gt(held.fair) ||
      (leg.fair.eq(held.fair) && costOf(leg).lt(costOf(held)))
    ) {
      best.set(key, leg);
    }
  }
  return [...best.values()].sort((a, b) => b.fair.comparedTo(a.fair));
}

export function composeDouble(
  candidates: readonly DoubleCandidate[],
  bounds: CouponClass = DOUBLE_COUPON_CLASS,
): DoubleComposition {
  const legs = shortlist(
    priceDoubleCandidates(candidates).filter(
      (leg) =>
        !POOL_EXCLUDED_MARKETS.includes(leg.market) &&
        leg.playableOdds >= bounds.minLegOdds &&
        leg.playableOdds <= bounds.maxLegOdds,
    ),
  );
  const candidateCount = legs.length;
  if (candidateCount < 2) {
    return {
      outcome: "abstained",
      reason: "no_priced_candidate",
      candidateCount,
    };
  }

  // Les jambes sont triées par probabilité décroissante : le produit baisse
  // quand j avance, et la meilleure paire commençant par i ne peut pas
  // dépasser fair_i × fair_{i+1}. On s'arrête dès qu'une paire ne peut plus
  // faire mieux que la meilleure trouvée (à égalité, la marge départage :
  // on continue tant que le produit est égal).
  let best: Combo | null = null;
  for (let i = 0; i < legs.length; i++) {
    const first = legs[i] as DoubleLeg;
    const next = legs[i + 1];
    if (best && next && first.fair.times(next.fair).lt(best.score)) break;
    for (let j = i + 1; j < legs.length; j++) {
      const second = legs[j] as DoubleLeg;
      if (best && first.fair.times(second.fair).lt(best.score)) break;
      const pair = [first, second];
      if (!distinctFixtures(pair) || !inWindow(pair, bounds)) continue;
      const combo = comboOf(pair);
      if (better(combo, best)) best = combo;
    }
  }

  // Trois jambes seulement si aucune paire n'existe : chaque jambe de plus
  // repaie la marge du bookmaker.
  if (!best && bounds.maxLegs >= 3) {
    const maxLeg = Math.cbrt(bounds.targetOddsMax);
    const short = legs.filter((leg) => leg.playableOdds <= maxLeg).slice(0, 90);
    for (let i = 0; i < short.length; i++) {
      for (let j = i + 1; j < short.length; j++) {
        for (let k = j + 1; k < short.length; k++) {
          const triple = [
            short[i] as DoubleLeg,
            short[j] as DoubleLeg,
            short[k] as DoubleLeg,
          ];
          if (!distinctFixtures(triple) || !inWindow(triple, bounds)) continue;
          const combo = comboOf(triple);
          if (better(combo, best)) best = combo;
        }
      }
    }
  }

  if (!best) {
    return {
      outcome: "abstained",
      reason: "no_combination_in_window",
      candidateCount,
    };
  }
  return {
    outcome: "composed",
    legs: best.legs,
    playableCombinedOdds: best.legs.reduce(
      (acc, leg) => acc.times(leg.playableOdds),
      new Decimal(1),
    ),
    probability: best.score,
    candidateCount,
  };
}
