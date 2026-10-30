import Decimal from 'decimal.js';
import { classForTargetOddsMin } from '@evcore/analysis-core';
import type { CouponResult } from '@evcore/db';
import { PRODUCT_SHORT_LABEL } from './slip-digest.compose';

/** A settled match of a followed coupon. */
export type FollowedSettledLeg = {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: Date;
  /** True won, false lost, null refunded. */
  isCorrect: boolean | null;
  /** 1xBet price stored at generation; null when 1xBet had none. */
  operatorOdds: Decimal | null;
};

export type FollowedSettledCoupon = {
  targetOddsMin: number;
  source: string;
  result: CouponResult;
  legs: readonly FollowedSettledLeg[];
};

/**
 * « Ton Favori est passé ✓ » / « Ton Combiné a perdu ✗ », and one line
 * (docs/refonte-ui/10 § 3): the match and its score, where it broke, or
 * what was refunded. Never an amount, never a gain.
 */
export function composeFollowedSettled(coupon: FollowedSettledCoupon): {
  title: string;
  body: string;
} {
  const name = `Ton ${productName(coupon)}`;
  const legs = [...coupon.legs].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
  );
  switch (coupon.result) {
    case 'WON':
    case 'PARTIAL':
      return { title: `${name} est passé ✓`, body: wonLine(legs) };
    case 'LOST': {
      const broken = legs.find((leg) => leg.isCorrect === false);
      return {
        title: `${name} a perdu ✗`,
        body: broken ? `cassé sur ${matchLine(broken)}` : 'perdu',
      };
    }
    case 'VOID':
      return {
        title: `${name} est remboursé`,
        body:
          legs.length > 1
            ? 'matchs reportés ou annulés'
            : 'match reporté ou annulé',
      };
  }
}

/** « Favori », « Combiné », « Combiné IA » for the LLM's, else « coupon ». */
function productName(coupon: FollowedSettledCoupon): string {
  const product = classForTargetOddsMin(coupon.targetOddsMin);
  const label = product ? PRODUCT_SHORT_LABEL[product] : undefined;
  if (!label) return 'coupon';
  return coupon.source === 'LLM' ? `${label} IA` : label;
}

function matchLine(leg: FollowedSettledLeg): string {
  const score =
    leg.homeScore === null || leg.awayScore === null
      ? ''
      : ` ${leg.homeScore}-${leg.awayScore}`;
  return `${leg.home} – ${leg.away}${score}`;
}

/**
 * The match (one leg) or the count of matches won, then the odds really
 * paid at 1xBet: the product of the won legs' prices, a refunded leg paying
 * 1. Unknown when a won leg has no 1xBet price: then no odds at all, never
 * a borrowed one.
 */
function wonLine(legs: readonly FollowedSettledLeg[]): string {
  const won = legs.filter((leg) => leg.isCorrect === true);
  const [only] = legs;
  const what =
    legs.length === 1 && only
      ? matchLine(only)
      : won.length === legs.length
        ? `${legs.length} matchs`
        : `${won.length} matchs sur ${legs.length}`;
  const odds = paidOdds(won);
  return odds === null ? what : `${what} · ${odds}`;
}

function paidOdds(won: readonly FollowedSettledLeg[]): string | null {
  if (won.length === 0) return null;
  let product = new Decimal(1);
  for (const leg of won) {
    if (leg.operatorOdds === null) return null;
    product = product.times(leg.operatorOdds);
  }
  return product.toFixed(2).replace('.', ',');
}
