import { BetStatus, Market } from '@evcore/db';
import {
  resolveStatMarketBetStatus,
  type MatchFacts,
} from '@evcore/analysis-core';
import { DAY_MS } from '@utils/date.utils';
import {
  CORNERS_HUNTER_POLICY,
  STAT_MARKET_SETTLEMENT,
} from './coupon.constants';

/**
 * A leg of a market settled on the match facts (FACT_SETTLED_MARKETS:
 * corners, cards, scorers, player shots, a minute's 1X2…), once its match
 * is finished. Unknown is not lost: facts not in yet give null (wait);
 * past the grace period the leg is refunded (VOID), never counted lost.
 * Recomputed on every call, nothing kept: facts that arrive after a refund
 * grade the leg. Shared by the coupons and « Mon ticket ».
 */
export function settleFactLeg(input: {
  market: Market;
  pick: string;
  line: number | null;
  facts: MatchFacts | null;
  kickoff: Date;
  now: Date;
}): BetStatus | null {
  const { market, pick, line, facts, kickoff, now } = input;
  const status =
    facts === null
      ? null
      : resolveStatMarketBetStatus({ market, pick, line, facts });
  if (status !== null) return status;
  const graceDays =
    market === Market.CORNERS
      ? CORNERS_HUNTER_POLICY.statsGraceDays
      : STAT_MARKET_SETTLEMENT.graceDays;
  return now.getTime() - kickoff.getTime() >= graceDays * DAY_MS
    ? BetStatus.VOID
    : null;
}
