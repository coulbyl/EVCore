// Closing Line Value (chantier E du plan de rentabilité, tâche E-1).
//
// POURQUOI CET INDICATEUR. Le ROI d'un pari met des milliers de paris à
// converger : à nos volumes, l'erreur type d'un ROI de coupon se compte en
// dizaines de points. Le CLV, lui, ne dépend pas du résultat du match — il
// compare le prix obtenu au prix de clôture, qui est le meilleur estimateur
// public de la probabilité vraie. Il se mesure donc en semaines, pas en
// années, et c'est le seul indicateur qui dise AVANT le coup d'envoi si un
// pari avait de la valeur.
//
// CONVENTION. La marge est retirée des deux côtés par normalisation à
// l'intérieur du groupe de choix. Comparer une cote brute à une cote brute
// mesurerait surtout l'écart de marge entre deux books, pas la valeur.

import Decimal from "decimal.js";

/** Une issue cotée, telle que servie par un book. */
export type PricedOutcome = {
  pick: string;
  odds: Decimal;
};

/**
 * Probabilités implicites d'un groupe de choix, marge retirée.
 *
 * Le groupe doit être exclusif et exhaustif : `outcomeTotal` vaut 1 dans
 * l'immense majorité des cas, et 2 pour la double chance, dont les trois
 * issues se recouvrent (1X + 12 + X2 couvrent chaque résultat deux fois).
 * Passer un groupe incomplet produirait des probabilités surévaluées.
 */
export function fairProbabilities(
  outcomes: readonly PricedOutcome[],
  outcomeTotal = 1,
): Map<string, Decimal> | null {
  if (outcomes.length < 2 || outcomeTotal <= 0) return null;
  let overround = new Decimal(0);
  for (const outcome of outcomes) {
    if (outcome.odds.lte(1)) return null;
    overround = overround.plus(new Decimal(1).div(outcome.odds));
  }
  if (overround.lte(0)) return null;
  const divisor = overround.div(outcomeTotal);
  const fair = new Map<string, Decimal>();
  for (const outcome of outcomes) {
    fair.set(outcome.pick, new Decimal(1).div(outcome.odds).div(divisor));
  }
  return fair;
}

export type ClosingLineValueInput = {
  /** Cote effectivement obtenue au moment du pari. */
  takenOdds: Decimal;
  /** Choix pris, tel qu'il apparaît dans les deux groupes. */
  pick: string;
  /** Groupe de choix complet au moment du pari. */
  takenOutcomes: readonly PricedOutcome[];
  /** Groupe de choix complet à la clôture, chez le book de référence. */
  closingOutcomes: readonly PricedOutcome[];
  /** Somme des probabilités vraies du groupe : 1, sauf double chance (2). */
  outcomeTotal?: number;
};

export type ClosingLineValue = {
  /** Probabilité vraie du choix au moment du pari, marge retirée. */
  takenFair: Decimal;
  /** Probabilité vraie du choix à la clôture, marge retirée. */
  closingFair: Decimal;
  /**
   * Valeur prise sur la clôture : cote obtenue x probabilité de clôture − 1.
   *
   * Positive, le pari a été pris à un prix meilleur que ce que le marché a
   * fini par estimer. C'est la définition qui compte, parce qu'elle est
   * homogène à une espérance de gain : un CLV de +2 % annonce +2 % de ROI à
   * long terme si la clôture est bien calibrée.
   */
  value: Decimal;
  /**
   * Déplacement de la probabilité entre la prise et la clôture, en points.
   * Utile pour distinguer « bon prix » de « marché qui a bougé vers nous ».
   */
  probabilityDrift: Decimal;
};

/**
 * CLV d'un pari, ou `null` si l'un des deux groupes de choix est inexploitable
 * (incomplet, cote non jouable, choix absent).
 *
 * Retourner `null` plutôt qu'une valeur approchée est délibéré : un CLV
 * calculé sur un groupe incomplet serait biaisé dans une direction inconnue,
 * et le silence est préférable à un chiffre faux dans un indicateur qui sert
 * à décider.
 */
export function closingLineValue(
  input: ClosingLineValueInput,
): ClosingLineValue | null {
  const total = input.outcomeTotal ?? 1;
  const taken = fairProbabilities(input.takenOutcomes, total);
  const closing = fairProbabilities(input.closingOutcomes, total);
  if (!taken || !closing) return null;

  const takenFair = taken.get(input.pick);
  const closingFair = closing.get(input.pick);
  if (!takenFair || !closingFair) return null;
  if (input.takenOdds.lte(1)) return null;

  return {
    takenFair,
    closingFair,
    value: input.takenOdds.times(closingFair).minus(1),
    probabilityDrift: closingFair.minus(takenFair),
  };
}
