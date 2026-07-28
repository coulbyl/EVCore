import { Injectable } from '@nestjs/common';
import { BetStatus, CouponResult } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { SubscriptionsRepository } from './subscriptions.repository';

const logger = createLogger('subscription-settlement');

// CouponResult a un quatrième état (PARTIAL) que BetStatus n'a pas — un
// coupon combiné n'est gagnant que si toutes les jambes le sont ; PARTIAL
// signifie qu'aucune jambe n'a perdu mais que certaines ont été annulées
// (VOID), pas que le coupon a "à moitié" gagné. Le traiter comme un pari
// remboursé (VOID, pnl = 0) est plus honnête qu'une perte sèche.
function toBetStatus(result: CouponResult): BetStatus {
  if (result === CouponResult.WON) return BetStatus.WON;
  if (result === CouponResult.LOST) return BetStatus.LOST;
  return BetStatus.VOID; // PARTIAL ou VOID
}

function computePnl(
  stake: Decimal,
  odds: Decimal | null,
  result: BetStatus,
): Decimal {
  if (result === BetStatus.WON) {
    return odds ? stake.mul(odds.minus(1)) : new Decimal(0);
  }
  if (result === BetStatus.LOST) {
    return stake.negated();
  }
  return new Decimal(0); // VOID
}

@Injectable()
export class SubscriptionSettlementService {
  constructor(private readonly repository: SubscriptionsRepository) {}

  // Appelé depuis PendingBetsSettlementWorker, même cadence que le règlement
  // des coupons/bets (voir DESIGN.md §Pipeline quotidien, 2).
  async settleReadyEvents(): Promise<void> {
    const events = await this.repository.findReadyToSettle();
    if (events.length === 0) return;

    let settled = 0;
    for (const event of events) {
      const sourceResult =
        event.couponProposal?.result ?? event.channelSelection?.result;
      if (!sourceResult) continue; // ne devrait pas arriver (filtré côté requête)

      const result = event.couponProposal
        ? toBetStatus(event.couponProposal.result!)
        : (event.channelSelection!.result as BetStatus);

      const stake = new Decimal(event.stake);
      const odds = event.odds ? new Decimal(event.odds) : null;
      const pnl = computePnl(stake, odds, result);
      const settledAt = new Date();

      await this.repository.settleEvent(event.id, { result, pnl, settledAt });
      await this.repository.incrementSubscriptionOnSettlement(
        event.subscriptionId,
        { won: result === BetStatus.WON, pnl },
      );
      settled += 1;
    }

    if (settled > 0) {
      logger.info({ settled }, 'Subscription events settled');
    }
  }
}
