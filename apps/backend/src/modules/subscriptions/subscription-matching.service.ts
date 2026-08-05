import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionSourceType } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { InvestmentService } from '@modules/investment/investment.service';
import { ChannelDecisionService } from '@modules/betting-engine/channel-decision.service';
import { findSubscriptionSource } from './subscription.constants';
import { SubscriptionsRepository } from './subscriptions.repository';

const logger = createLogger('subscription-matching');

type EventCandidate = {
  couponProposalId: string | null;
  channelSelectionId: string | null;
  odds: Decimal | null;
};

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Un coupon combine plusieurs matchs — dès que le premier a débuté, le
// coupon entier n'est plus "plaçable" (un bookmaker refuserait la
// combinaison). On compare donc l'instant de création de l'abonnement au
// coup d'envoi le plus tôt parmi ses legs, pas au dernier.
function earliestLegKickoff(legs: { fixture: { scheduledAt: Date } }[]): Date {
  return legs.reduce(
    (min, leg) =>
      leg.fixture.scheduledAt < min ? leg.fixture.scheduledAt : min,
    new Date(0), // pas de legs => traité comme déjà commencé, donc exclu
  );
}

@Injectable()
export class SubscriptionMatchingService {
  constructor(
    private readonly repository: SubscriptionsRepository,
    private readonly investmentService: InvestmentService,
    private readonly channelDecisionService: ChannelDecisionService,
  ) {}

  // Point d'entrée du job quotidien (voir DESIGN.md §Pipeline quotidien, 1).
  // Idempotent : rejouable plusieurs fois par jour sans dupliquer d'événement
  // — matchOne() s'arrête dès qu'un événement existe déjà pour la date
  // (repository.hasEventForDate), donc les sources ne sont jamais réévaluées
  // deux fois le même jour. Ne pas se fier à la contrainte @@unique du
  // modèle : couponProposalId/channelSelectionId sont mutuellement exclusifs
  // (l'un des deux est toujours NULL), et Postgres ne déduplique pas des
  // colonnes NULL dans une contrainte unique — createMany({ skipDuplicates })
  // seul ne suffit pas.
  async runDailyMatching(now: Date = new Date()): Promise<void> {
    const today = startOfUtcDay(now);

    const expiredCount = await this.repository.markExpired(today);
    if (expiredCount > 0) {
      logger.info({ expiredCount }, 'Subscriptions marked ENDED');
    }

    const subscriptions = await this.repository.findActiveDue(today);
    logger.info(
      { count: subscriptions.length, date: toIsoDate(today) },
      'Evaluating active subscriptions for today',
    );

    for (const subscription of subscriptions) {
      try {
        await this.matchOne(subscription, today);
      } catch (err) {
        logger.error(
          { subscriptionId: subscription.id, err },
          'Failed to match subscription for today',
        );
      }
    }
  }

  private async matchOne(
    subscription: {
      id: string;
      sourceType: SubscriptionSourceType;
      channelPickMode: string | null;
      topN: number | null;
      stakePerEvent: Prisma.Decimal;
      daysOfWeek: number[];
      competitionCodes: string[];
      createdAt: Date;
    },
    today: Date,
  ): Promise<void> {
    const eligible = await this.isDayEligible(
      today,
      subscription.daysOfWeek,
      subscription.competitionCodes,
    );
    if (!eligible) return;

    const alreadyMatched = await this.repository.hasEventForDate(
      subscription.id,
      today,
    );
    if (alreadyMatched) return;

    const candidates = await this.findEventCandidates(
      subscription,
      today,
      subscription.createdAt,
    );
    if (candidates.length === 0) return;

    const stake = new Decimal(subscription.stakePerEvent);
    const created = await this.repository.createEventsSkippingDuplicates(
      candidates.map((c) => ({
        subscriptionId: subscription.id,
        date: today,
        couponProposalId: c.couponProposalId,
        channelSelectionId: c.channelSelectionId,
        stake,
        odds: c.odds,
      })),
    );

    if (created > 0) {
      await this.repository.incrementSubscriptionOnNewEvents(
        subscription.id,
        created,
        stake.mul(created),
      );
    }
  }

  private async isDayEligible(
    today: Date,
    daysOfWeek: number[],
    competitionCodes: string[],
  ): Promise<boolean> {
    if (daysOfWeek.includes(today.getUTCDay())) return true;
    if (competitionCodes.length === 0) return false;
    const fixture = await this.repository.findFixtureTodayInCompetitions(
      today,
      competitionCodes,
    );
    return fixture !== null;
  }

  private async findEventCandidates(
    subscription: {
      sourceType: SubscriptionSourceType;
      channelPickMode: string | null;
      topN: number | null;
    },
    today: Date,
    createdAt: Date,
  ): Promise<EventCandidate[]> {
    // Un abonnement ne doit jamais récupérer un match déjà commencé/joué au
    // moment de sa création — le job tourne toutes les heures (cron), donc un
    // abonnement créé en cours de journée verrait sinon les picks du matin
    // déjà joués ré-ajoutés dès le premier passage. On exclut tout candidat
    // dont le coup d'envoi (ou, pour un coupon, le premier match qui le
    // compose) précède l'instant de création.
    if (subscription.sourceType === SubscriptionSourceType.COUPON_BEST) {
      const proposal = await this.repository.findCouponProposalRankOne(today);
      if (!proposal || earliestLegKickoff(proposal.legs) < createdAt) {
        return [];
      }
      return [
        {
          couponProposalId: proposal.id,
          channelSelectionId: null,
          odds: new Decimal(proposal.combinedOdds),
        },
      ];
    }

    if (subscription.sourceType === SubscriptionSourceType.COUPON_ALL) {
      const proposals = await this.repository.findAllCouponProposals(today);
      return proposals
        .filter((p) => earliestLegKickoff(p.legs) >= createdAt)
        .map((p) => ({
          couponProposalId: p.id,
          channelSelectionId: null,
          odds: new Decimal(p.combinedOdds),
        }));
    }

    // Sources CHANNEL_* : channelPickMode et topN sont garantis non-null par
    // la validation à la création (SubscriptionsService.create).
    const source = findSubscriptionSource(subscription.sourceType);
    if (
      !source ||
      source.kind !== 'CHANNEL' ||
      !source.channel ||
      !source.investmentMode
    ) {
      return [];
    }
    const topN = subscription.topN ?? 1;

    if (subscription.channelPickMode === 'INVESTIR') {
      const picks = await this.investmentService.listBestPicks({
        date: toIsoDate(today),
        mode: source.investmentMode,
        topN,
      });
      return picks
        .filter((pick) => new Date(pick.scheduledAt) >= createdAt)
        .slice(0, topN)
        .map((pick) => ({
          couponProposalId: null,
          channelSelectionId: pick.channelSelectionId,
          odds: new Decimal(pick.odds),
        }));
    }

    // 'DECISIONS_FIRST'/'DECISIONS_LAST' : matchs du jour par heure de coup
    // d'envoi, sans classement proba/edge (voir DESIGN.md §Décisions de
    // conception, point 2) — seul l'axe chronologique (premiers vs derniers)
    // change, laissé au choix de l'utilisateur (backtest day-by-day
    // db:backtest:decisions-ranking, 2026-07-29 : "derniers" bat ou égale
    // "premiers" sur les 6 canaux mais aucun des deux ne domine partout).
    const groups = await this.channelDecisionService.listByChannel({
      date: toIsoDate(today),
      channel: source.channel,
    });
    const group = groups.find((g) => g.channel === source.channel);
    if (!group) return [];

    const withOdds = group.decisions.filter(
      (d) =>
        d.selections[0] &&
        d.selections[0].odds !== null &&
        new Date(d.scheduledAt) >= createdAt,
    );
    // listByChannel trie déjà par coup d'envoi croissant — inverser suffit
    // pour obtenir les derniers du jour en premier.
    const ordered =
      subscription.channelPickMode === 'DECISIONS_LAST'
        ? [...withOdds].reverse()
        : withOdds;
    return ordered.slice(0, topN).map((decision) => {
      const primary = decision.selections[0];
      return {
        couponProposalId: null,
        channelSelectionId: primary.id,
        odds: new Decimal(primary.odds!),
      };
    });
  }
}
