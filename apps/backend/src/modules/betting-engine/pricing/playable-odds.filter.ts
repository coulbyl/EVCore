import {
  playableQuoteKey,
  type PlayableQuote,
  type PlayableQuoteKey,
} from './playable-odds.repository';
import { OPERATOR_MIN_ODDS } from '@evcore/analysis-core';

/**
 * Garde « jouable chez l'opérateur » : écarte un candidat dont le prix chez
 * le book de l'utilisateur (sinon le plus bas relevé) est sous son minimum.
 * Un candidat sans relevé passe — on ne refuse que ce qu'on a mesuré.
 *
 * Le plancher de 1,20 sur la référence ne suffit pas seul : le 2026-10-16,
 * une jambe à 1,20 chez Bet365 valait 1,07 chez 1xBet.
 */
export function playableAtOperator(
  candidate: PlayableQuoteKey,
  quotes: Map<string, PlayableQuote>,
): boolean {
  const quote = quotes.get(playableQuoteKey(candidate));
  if (!quote) return true;
  const price = quote.operatorOdds ?? quote.lowestOdds;
  return price === null || price >= OPERATOR_MIN_ODDS;
}

/** Prix et marge chez le book des joueurs, à écrire sur une jambe de coupon. */
export function operatorPrice(
  candidate: PlayableQuoteKey,
  quotes: Map<string, PlayableQuote>,
): {
  operatorOdds: number | null;
  operatorMargin: number | null;
  operatorFairProbability: number | null;
} {
  const quote = quotes.get(playableQuoteKey(candidate));
  // Les trois viennent du même relevé : ils voyagent ensemble.
  return {
    operatorOdds: quote?.operatorOdds ?? null,
    operatorMargin: quote?.operatorMargin ?? null,
    operatorFairProbability: quote?.operatorFairProbability ?? null,
  };
}
