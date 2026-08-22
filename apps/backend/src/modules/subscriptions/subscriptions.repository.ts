import { Injectable } from '@nestjs/common';
import {
  BetStatus,
  Prisma,
  SubscriptionChannelPickMode,
  SubscriptionSourceType,
  SubscriptionStatus,
} from '@evcore/db';
import Decimal from 'decimal.js';
import { SUBSCRIPTION_COUPON_CLASS } from './subscription.constants';
import { PrismaService } from '@/prisma.service';
import { SUBSCRIPTION_DETAIL_EVENTS_LIMIT } from './subscription.constants';

export type CreateSubscriptionInput = {
  userId: string;
  sourceType: SubscriptionSourceType;
  sourceLabel: string;
  channelPickMode: SubscriptionChannelPickMode | null;
  topN: number | null;
  stakePerEvent: Decimal;
  daysOfWeek: number[];
  competitionCodes: string[];
  startDate: Date;
  endDate: Date;
};

// Logo + nom repris sur chaque event du détail d'abonnement — aide à
// retrouver le match chez un bookmaker (recherche par équipe/logo).
const SUBSCRIPTION_EVENT_TEAM_SELECT = {
  select: { name: true, logoUrl: true } satisfies Prisma.TeamSelect,
};

const SUBSCRIPTION_LIST_SELECT = {
  id: true,
  sourceType: true,
  sourceLabel: true,
  channelPickMode: true,
  topN: true,
  stakePerEvent: true,
  daysOfWeek: true,
  competitionCodes: true,
  startDate: true,
  endDate: true,
  status: true,
  cancelledAt: true,
  totalEvents: true,
  settledEvents: true,
  wonEvents: true,
  totalStaked: true,
  netPnl: true,
  createdAt: true,
} satisfies Prisma.SubscriptionSelect;

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSubscriptionInput) {
    return this.prisma.client.subscription.create({
      data: {
        userId: input.userId,
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel,
        channelPickMode: input.channelPickMode,
        topN: input.topN,
        stakePerEvent: input.stakePerEvent,
        daysOfWeek: input.daysOfWeek,
        competitionCodes: input.competitionCodes,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      select: SUBSCRIPTION_LIST_SELECT,
    });
  }

  findByUser(userId: string) {
    return this.prisma.client.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: SUBSCRIPTION_LIST_SELECT,
    });
  }

  findByIdForUser(id: string, userId: string) {
    return this.prisma.client.subscription.findFirst({
      where: { id, userId },
      select: SUBSCRIPTION_LIST_SELECT,
    });
  }

  async cancel(id: string, userId: string) {
    const result = await this.prisma.client.subscription.updateMany({
      where: {
        id,
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    return result.count > 0;
  }

  // Suppression définitive — les SubscriptionEvent liés sont supprimés en
  // cascade au niveau DB (onDelete: Cascade sur subscription_event.subscriptionId).
  async remove(id: string, userId: string) {
    const result = await this.prisma.client.subscription.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  // Catalogue du multi-select de compétitions (GET /subscriptions/catalog) —
  // aucun endpoint "liste des compétitions" réutilisable ailleurs dans le
  // backend, requête autonome ici plutôt que d'en créer un nouveau module.
  findActiveCompetitions() {
    return this.prisma.client.competition.findMany({
      where: { isActive: true },
      select: { code: true, name: true, country: true },
      orderBy: { name: 'asc' },
    });
  }

  // Compétitions actives dont le code figure dans la liste — sert à valider
  // que chaque competitionCode soumis par le client existe réellement.
  findActiveCompetitionCodes(codes: string[]) {
    if (codes.length === 0) return Promise.resolve([]);
    return this.prisma.client.competition
      .findMany({
        where: { code: { in: codes }, isActive: true },
        select: { code: true },
      })
      .then((rows) => rows.map((r) => r.code));
  }

  // Abonnements à évaluer par le job de matching quotidien : actifs et dans
  // leur fenêtre [startDate, endDate].
  findActiveDue(today: Date) {
    return this.prisma.client.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });
  }

  // Abonnements encore ACTIVE mais dont endDate est dépassée — à terminer.
  async markExpired(today: Date): Promise<number> {
    const result = await this.prisma.client.subscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lt: today },
      },
      data: { status: SubscriptionStatus.ENDED },
    });
    return result.count;
  }

  findFixtureTodayInCompetitions(date: Date, competitionCodes: string[]) {
    if (competitionCodes.length === 0) return Promise.resolve(null);
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return this.prisma.client.fixture.findFirst({
      where: {
        scheduledAt: { gte: dayStart, lt: dayEnd },
        season: { competition: { code: { in: competitionCodes } } },
      },
      select: { id: true },
    });
  }

  /**
   * Le coupon « du jour » pour un abonnement COUPON_BEST.
   *
   * Ne peut plus être `{ forDate, rank: 1 }` : depuis l'introduction des
   * classes (2026-08-22), CHAQUE classe écrit ses propres rangs 1..3, donc
   * trois lignes portent `rank = 1` sur une même date — vérifié en base, 3
   * collisions par jour sur 9 propositions. `findFirst` sans tri en prenait
   * une au hasard : l'abonné recevait un coupon non déterministe, qui pouvait
   * changer d'une exécution du cron à l'autre.
   *
   * Et « meilleur » ne veut plus rien dire non plus : mesuré sur 5 passes de
   * régénération, le rang 1 ne fait pas mieux que le rang 2 (en classe à cote
   * courte, -7.5% contre +2.6%, tous les écarts dans le bruit).
   *
   * Choix retenu : le coupon de plus forte probabilité jointe de la journée,
   * ce qui revient au rang 1 de la classe à cote courte. C'est déterministe,
   * c'est ce qu'un abonné « un coupon par jour » attend, et ça ne prétend pas
   * à une hiérarchie qu'on ne sait pas produire.
   */
  findCouponProposalRankOne(forDate: Date) {
    return this.prisma.client.couponProposal.findFirst({
      where: { forDate },
      orderBy: [{ jointProbability: 'desc' }, { rank: 'asc' }],
      select: {
        id: true,
        combinedOdds: true,
        result: true,
        legs: { select: { fixture: { select: { scheduledAt: true } } } },
      },
    });
  }

  /**
   * Tous les coupons du jour pour un abonnement COUPON_ALL — mise pleine sur
   * chacun.
   *
   * ⚠️ Le VOLUME a triplé le 2026-08-22 avec les classes : jusqu'à 9 coupons
   * par jour (3 classes × 3) au lieu de 3, donc trois fois la mise engagée
   * pour un abonné qui n'a rien changé à son abonnement. Vérifié en base.
   *
   * Restreint à la classe à cote courte pour préserver ce à quoi les abonnés
   * existants ont souscrit — un volume et un profil de risque comparables à
   * l'avant-classes. Couvrir les trois classes est une décision produit
   * distincte : elle demanderait un nouveau type de source par classe (enum
   * Prisma `SubscriptionSourceType`, donc migration) plutôt que d'élargir
   * silencieusement un abonnement en cours.
   */
  findAllCouponProposals(forDate: Date) {
    return this.prisma.client.couponProposal.findMany({
      where: {
        forDate,
        targetOddsMin: SUBSCRIPTION_COUPON_CLASS.targetOddsMin,
      },
      select: {
        id: true,
        combinedOdds: true,
        result: true,
        legs: { select: { fixture: { select: { scheduledAt: true } } } },
      },
      orderBy: { rank: 'asc' },
    });
  }

  // Un abonnement déjà matché pour cette date a forcément ses événements du
  // jour en base — les sources (coupons/topN) sont déterministes par date,
  // donc rejouer le job le même jour n'a rien de nouveau à produire.
  async hasEventForDate(subscriptionId: string, date: Date): Promise<boolean> {
    const existing = await this.prisma.client.subscriptionEvent.findFirst({
      where: { subscriptionId, date },
      select: { id: true },
    });
    return existing !== null;
  }

  async createEventsSkippingDuplicates(
    events: Array<{
      subscriptionId: string;
      date: Date;
      couponProposalId: string | null;
      channelSelectionId: string | null;
      stake: Decimal;
      odds: Decimal | null;
    }>,
  ): Promise<number> {
    if (events.length === 0) return 0;
    const result = await this.prisma.client.subscriptionEvent.createMany({
      data: events,
      skipDuplicates: true,
    });
    return result.count;
  }

  incrementSubscriptionOnNewEvents(
    subscriptionId: string,
    count: number,
    totalStake: Decimal,
  ) {
    if (count === 0) return Promise.resolve(null);
    return this.prisma.client.subscription.update({
      where: { id: subscriptionId },
      data: {
        totalEvents: { increment: count },
        totalStaked: { increment: totalStake },
      },
    });
  }

  // Événements en attente dont la source (coupon ou sélection de canal) a
  // désormais un résultat connu — prêts à être réglés.
  findReadyToSettle() {
    return this.prisma.client.subscriptionEvent.findMany({
      where: {
        result: null,
        OR: [
          { couponProposal: { result: { not: null } } },
          { channelSelection: { result: { not: null } } },
        ],
      },
      select: {
        id: true,
        subscriptionId: true,
        stake: true,
        odds: true,
        subscription: {
          select: { userId: true, sourceType: true, sourceLabel: true },
        },
        couponProposal: { select: { result: true } },
        channelSelection: { select: { result: true } },
      },
    });
  }

  settleEvent(
    id: string,
    data: { result: BetStatus; pnl: Decimal; settledAt: Date },
  ) {
    return this.prisma.client.subscriptionEvent.update({
      where: { id },
      data,
    });
  }

  incrementSubscriptionOnSettlement(
    subscriptionId: string,
    data: { won: boolean; pnl: Decimal },
  ) {
    return this.prisma.client.subscription.update({
      where: { id: subscriptionId },
      data: {
        settledEvents: { increment: 1 },
        wonEvents: data.won ? { increment: 1 } : undefined,
        netPnl: { increment: data.pnl },
      },
    });
  }

  findEventsForSubscription(subscriptionId: string) {
    return this.prisma.client.subscriptionEvent.findMany({
      where: { subscriptionId },
      orderBy: { date: 'desc' },
      take: SUBSCRIPTION_DETAIL_EVENTS_LIMIT,
      select: {
        id: true,
        date: true,
        stake: true,
        odds: true,
        result: true,
        pnl: true,
        settledAt: true,
        couponProposal: {
          select: {
            combinedOdds: true,
            legs: {
              select: {
                market: true,
                pick: true,
                fixture: {
                  select: {
                    homeTeam: SUBSCRIPTION_EVENT_TEAM_SELECT,
                    awayTeam: SUBSCRIPTION_EVENT_TEAM_SELECT,
                    season: {
                      select: { competition: { select: { country: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        channelSelection: {
          select: {
            market: true,
            pick: true,
            channelDecision: {
              select: {
                modelRun: {
                  select: {
                    fixture: {
                      select: {
                        scheduledAt: true,
                        homeTeam: SUBSCRIPTION_EVENT_TEAM_SELECT,
                        awayTeam: SUBSCRIPTION_EVENT_TEAM_SELECT,
                        season: {
                          select: {
                            competition: { select: { country: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }
}
