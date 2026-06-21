import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { isHalfTimeFullTimePick } from '../betting-engine.utils';
import type { ComboPick } from '../betting-engine.utils';
import {
  COMBO_CORRELATION_ALPHA,
  COMBO_CORRELATION_MAX_FACTOR,
  COMBO_CORRELATION_MIN_FACTOR,
} from '../ev.constants';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
  ViablePick,
} from '../betting-engine.types';

// Returns odds for a pick within a FullOddsSnapshot (single-market, no combo).
export function getPickOddsFromSnapshot(
  market: Market,
  pick: string,
  odds: FullOddsSnapshot,
): Decimal | null {
  if (market === Market.ONE_X_TWO) {
    if (pick === 'HOME') return odds.homeOdds;
    if (pick === 'DRAW') return odds.drawOdds;
    if (pick === 'AWAY') return odds.awayOdds;
  }
  if (market === Market.OVER_UNDER) {
    return odds.overUnderOdds[pick as keyof typeof odds.overUnderOdds] ?? null;
  }
  if (market === Market.BTTS) {
    if (pick === 'YES') return odds.bttsYesOdds;
    if (pick === 'NO') return odds.bttsNoOdds;
  }
  if (market === Market.HALF_TIME_FULL_TIME) {
    if (isHalfTimeFullTimePick(pick)) {
      return odds.htftOdds[pick] ?? null;
    }
  }
  if (market === Market.OVER_UNDER_HT) {
    return odds.ouHtOdds[pick as keyof typeof odds.ouHtOdds] ?? null;
  }
  if (
    market === Market.FIRST_HALF_WINNER &&
    odds.firstHalfWinnerOdds !== null
  ) {
    if (pick === 'HOME') return odds.firstHalfWinnerOdds.home;
    if (pick === 'DRAW') return odds.firstHalfWinnerOdds.draw;
    if (pick === 'AWAY') return odds.firstHalfWinnerOdds.away;
  }
  if (market === Market.DOUBLE_CHANCE && odds.doubleChanceOdds !== null) {
    return odds.doubleChanceOdds[pick as '1X' | 'X2' | '12'] ?? null;
  }
  return null;
}

// Returns the odds of the primary market pick for a ViablePick.
// Used for line movement comparison.
export function getPickOdds(
  pick: ViablePick,
  odds: FullOddsSnapshot,
): Decimal | null {
  return getPickOddsFromSnapshot(pick.market, pick.pick, odds);
}

export function getModelProbabilityForPick(
  market: Market,
  pick: string,
  probabilities: MatchProbabilities,
): Decimal | null {
  if (market === Market.ONE_X_TWO) {
    if (pick === 'HOME') return probabilities.home;
    if (pick === 'DRAW') return probabilities.draw;
    if (pick === 'AWAY') return probabilities.away;
  }
  if (market === Market.DOUBLE_CHANCE) {
    if (pick === '1X') return probabilities.dc1X;
    if (pick === 'X2') return probabilities.dcX2;
    if (pick === '12') return probabilities.dc12;
  }
  if (market === Market.OVER_UNDER) {
    if (pick === 'OVER_1_5') return probabilities.over15;
    if (pick === 'UNDER_1_5') return probabilities.under15;
    if (pick === 'OVER') return probabilities.over25;
    if (pick === 'UNDER') return probabilities.under25;
    if (pick === 'OVER_3_5') return probabilities.over35;
    if (pick === 'UNDER_3_5') return probabilities.under35;
    if (pick === 'OVER_4_5') return probabilities.over45;
    if (pick === 'UNDER_4_5') return probabilities.under45;
  }
  if (market === Market.BTTS) {
    if (pick === 'YES') return probabilities.bttsYes;
    if (pick === 'NO') return probabilities.bttsNo;
  }
  if (market === Market.HALF_TIME_FULL_TIME && isHalfTimeFullTimePick(pick)) {
    return probabilities.htft[pick];
  }
  if (market === Market.OVER_UNDER_HT) {
    return probabilities.ouHT[pick as keyof typeof probabilities.ouHT] ?? null;
  }
  if (market === Market.FIRST_HALF_WINNER) {
    if (pick === 'HOME') return probabilities.firstHalfWinner.home;
    if (pick === 'DRAW') return probabilities.firstHalfWinner.draw;
    if (pick === 'AWAY') return probabilities.firstHalfWinner.away;
  }
  return null;
}

export function estimateComboOdds(input: {
  combo: ComboPick;
  probabilities: MatchProbabilities;
  jointProbability: Decimal;
  odds1: Decimal;
  odds2: Decimal;
}): Decimal {
  const { combo, probabilities, jointProbability, odds1, odds2 } = input;
  const probability1 = getModelProbabilityForPick(
    combo.market1,
    combo.pick1,
    probabilities,
  );
  const probability2 = getModelProbabilityForPick(
    combo.market2,
    combo.pick2,
    probabilities,
  );

  const rawProduct = odds1.mul(odds2);
  if (
    probability1 === null ||
    probability2 === null ||
    jointProbability.lte(0) ||
    probability1.lte(0) ||
    probability2.lte(0)
  ) {
    return rawProduct;
  }

  const independentProbability = probability1.mul(probability2);
  if (independentProbability.lte(0)) {
    return rawProduct;
  }

  const correlationFactor = independentProbability
    .div(jointProbability)
    .pow(COMBO_CORRELATION_ALPHA);
  const clampedFactor = Decimal.min(
    COMBO_CORRELATION_MAX_FACTOR,
    Decimal.max(COMBO_CORRELATION_MIN_FACTOR, correlationFactor),
  );

  return rawProduct.mul(clampedFactor);
}
