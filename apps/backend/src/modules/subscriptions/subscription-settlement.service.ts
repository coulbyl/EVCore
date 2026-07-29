import { Injectable } from '@nestjs/common';
import { BetStatus, CouponResult } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { PushService } from '@modules/push/push.service';
import { SubscriptionsRepository } from './subscriptions.repository';

const logger = createLogger('subscription-settlement');

type SettlementTally = {
  userId: string;
  sourceLabel: string;
  won: number;
  lost: number;
  void: number;
  pnl: Decimal;
};

function formatSignedAmount(value: Decimal): string {
  const amount = value.abs().toNumber().toLocaleString('fr-FR');
  return `${value.isNegative() ? '-' : '+'}${amount} F`;
}

// Un seul push par abonnement par passage de règlement, même si plusieurs
// événements se règlent dans le même run (ex. topN=5) — évite de spammer
// l'utilisateur d'une notification par événement.
function tallyMessage(tally: SettlementTally): string {
  const parts: string[] = [];
  if (tally.won > 0) parts.push(`${tally.won} gagné(s)`);
  if (tally.lost > 0) parts.push(`${tally.lost} perdu(s)`);
  if (tally.void > 0) parts.push(`${tally.void} remboursé(s)`);
  return `${parts.join(', ')} · ${formatSignedAmount(tally.pnl)}`;
}

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
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly push: PushService,
  ) {}

  // Appelé depuis PendingBetsSettlementWorker, même cadence que le règlement
  // des coupons/bets (voir DESIGN.md §Pipeline quotidien, 2).
  async settleReadyEvents(): Promise<void> {
    const events = await this.repository.findReadyToSettle();
    if (events.length === 0) return;

    const tallies = new Map<string, SettlementTally>();
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

      const tally = tallies.get(event.subscriptionId) ?? {
        userId: event.subscription.userId,
        sourceLabel: event.subscription.sourceLabel,
        won: 0,
        lost: 0,
        void: 0,
        pnl: new Decimal(0),
      };
      if (result === BetStatus.WON) tally.won += 1;
      else if (result === BetStatus.LOST) tally.lost += 1;
      else tally.void += 1;
      tally.pnl = tally.pnl.plus(pnl);
      tallies.set(event.subscriptionId, tally);
    }

    await Promise.all(
      [...tallies.entries()].map(([subscriptionId, tally]) =>
        this.push.sendToUser(tally.userId, {
          title: `Abonnement — ${tally.sourceLabel}`,
          body: tallyMessage(tally),
          url: `/dashboard/subscriptions/${subscriptionId}`,
        }),
      ),
    );

    if (settled > 0) {
      logger.info({ settled }, 'Subscription events settled');
    }
  }
}
