import Decimal from 'decimal.js';
import type { Prisma } from '@evcore/db';
import { ENGINE_CHANCE_MAX_ODDS } from '@config/screens.constants';

/** What a leg stores that its price and its chance are read from. */
export type PricedLeg = {
  /** The 1xBet price stored at generation. */
  operatorOdds: Prisma.Decimal | null;
  /** The reference price the engine composed on. */
  oddsSnapshot: Prisma.Decimal | null;
  /** The leg's announced probability. */
  probability: Prisma.Decimal;
  /** Shin's frequency on 1xBet's group, read with operatorOdds. */
  operatorFairProbability: Prisma.Decimal | null;
};

/**
 * A leg's chance (06 § 2): the engine's announced probability up to
 * ENGINE_CHANCE_MAX_ODDS, the market's frequency without margin above —
 * the engine is optimistic there. The odds compared are the ones shown
 * (1xBet's, else the reference). Above the threshold without a market
 * frequency, the chance is unknown: never the engine's in its place.
 */
export function legChanceOf(leg: PricedLeg): Decimal | null {
  const odds = leg.operatorOdds ?? leg.oddsSnapshot;
  if (odds !== null && Number(odds) > ENGINE_CHANCE_MAX_ODDS) {
    return leg.operatorFairProbability === null
      ? null
      : new Decimal(leg.operatorFairProbability.toString());
  }
  return new Decimal(leg.probability.toString());
}

/** Π of the legs' chances, in decimal.js; unknown if one is. */
export function couponChanceOf(legs: readonly PricedLeg[]): number | null {
  let chance = new Decimal(1);
  for (const leg of legs) {
    const legChance = legChanceOf(leg);
    if (legChance === null) return null;
    chance = chance.times(legChance);
  }
  return chance.toDecimalPlaces(4).toNumber();
}

/**
 * The 1xBet price of a set of legs: the product of their prices, in
 * decimal.js. A leg without a 1xBet price makes the whole price unknown,
 * never borrowed from the reference odds (docs/review-expectations.md).
 */
export function operatorOddsOf(
  legs: readonly Pick<PricedLeg, 'operatorOdds'>[],
): Decimal | null {
  let product = new Decimal(1);
  for (const leg of legs) {
    if (leg.operatorOdds === null) return null;
    product = product.times(leg.operatorOdds.toString());
  }
  return product;
}
