import { Injectable } from '@nestjs/common';
import {
  BetStatus,
  Prisma,
  SubscriptionChannelPickMode,
  SubscriptionSourceType,
  SubscriptionStatus,
} from '@evcore/db';
import Decimal from 'decimal.js';
import { PrismaService } from '@/prisma.service';

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

  findCouponProposalRankOne(forDate: Date) {
    return this.prisma.client.couponProposal.findFirst({
      where: { forDate, rank: 1 },
      select: { id: true, combinedOdds: true, result: true },
    });
  }

  findAllCouponProposals(forDate: Date) {
    return this.prisma.client.couponProposal.findMany({
      where: { forDate },
      select: { id: true, combinedOdds: true, result: true },
      orderBy: { rank: 'asc' },
    });
  }

  // Un événement par (subscriptionId, date, couponProposalId, channelSelectionId)
  // — createMany + skipDuplicates fait respecter l'idempotence via la
  // contrainte @@unique du modèle sans pré-vérification manuelle ; le count
  // retourné exclut les doublons déjà présents.
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
      select: {
        id: true,
        date: true,
        stake: true,
        odds: true,
        result: true,
        pnl: true,
        settledAt: true,
        couponProposal: { select: { combinedOdds: true } },
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
                        homeTeam: { select: { name: true } },
                        awayTeam: { select: { name: true } },
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
