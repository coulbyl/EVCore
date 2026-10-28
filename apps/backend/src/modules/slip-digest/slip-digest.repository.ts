import { Injectable } from '@nestjs/common';
import {
  type BetSlipType,
  type BetStatus,
  type CouponResult,
  type CouponSource,
  NotificationType,
  type Prisma,
} from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export type DigestSlip = {
  id: string;
  type: BetSlipType;
  unitStake: Prisma.Decimal;
  user: { id: string; currency: string | null; pausedUntil: Date | null };
  items: {
    stakeOverride: Prisma.Decimal | null;
    fixture: { scheduledAt: Date };
    bet: { status: BetStatus; oddsSnapshot: Prisma.Decimal | null };
  }[];
};

export type DigestFollow = {
  user: { id: string; currency: string | null; pausedUntil: Date | null };
  couponProposal: {
    id: string;
    result: CouponResult | null;
    targetOddsMin: Prisma.Decimal;
  };
};

export type DayCoupon = {
  source: CouponSource;
  targetOddsMin: Prisma.Decimal;
  combinedOdds: Prisma.Decimal;
  legs: { operatorOdds: Prisma.Decimal | null }[];
};

export type ReportedIds = { slipIds: Set<string>; followedIds: Set<string> };

function idsOf(payload: Prisma.JsonValue | null, key: string): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const ids = payload[key];
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
}

@Injectable()
export class SlipDigestRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Coupons dont au moins une jambe se jouait entre `from` et `to`, avec
   * toutes leurs jambes : le service ne garde que ceux dont la dernière jambe
   * tombait dans la fenêtre.
   */
  findSlipsTouching(from: Date, to: Date): Promise<DigestSlip[]> {
    return this.prisma.client.betSlip.findMany({
      where: {
        items: { some: { fixture: { scheduledAt: { gte: from, lt: to } } } },
      },
      select: {
        id: true,
        type: true,
        unitStake: true,
        user: { select: { id: true, currency: true, pausedUntil: true } },
        items: {
          select: {
            stakeOverride: true,
            fixture: { select: { scheduledAt: true } },
            bet: { select: { status: true, oddsSnapshot: true } },
          },
        },
      },
    });
  }

  /**
   * Coupons suivis (« Suivre ce coupon ») réglés, dont le dernier match se
   * jouait entre `from` et `to`.
   */
  findSettledFollows(from: Date, to: Date): Promise<DigestFollow[]> {
    return this.prisma.client.couponFollow.findMany({
      where: {
        couponProposal: {
          result: { not: null },
          lastFixtureScheduledAt: { gte: from, lt: to },
        },
      },
      select: {
        user: { select: { id: true, currency: true, pausedUntil: true } },
        couponProposal: {
          select: { id: true, result: true, targetOddsMin: true },
        },
      },
    });
  }

  /**
   * Coupons joués et coupons suivis déjà annoncés dans un résumé envoyé
   * depuis `since`.
   */
  async findReported(
    userIds: readonly string[],
    since: Date,
  ): Promise<ReportedIds> {
    if (userIds.length === 0) {
      return { slipIds: new Set(), followedIds: new Set() };
    }
    const digests = await this.prisma.client.notification.findMany({
      where: {
        userId: { in: [...userIds] },
        // La matinée remplace le résumé seul depuis le 2026-10-29 : les deux
        // portent les coupons déjà annoncés.
        type: {
          in: [
            NotificationType.SLIPS_SETTLED_DIGEST,
            NotificationType.MORNING_BRIEF,
          ],
        },
        createdAt: { gte: since },
      },
      select: { payload: true },
    });
    return {
      slipIds: new Set(digests.flatMap((d) => idsOf(d.payload, 'slipIds'))),
      followedIds: new Set(
        digests.flatMap((d) => idsOf(d.payload, 'followedIds')),
      ),
    };
  }

  /** Joueurs qui reçoivent la matinée (réglage actif, 2026-10-29). */
  findMorningRecipients(): Promise<
    { id: string; currency: string | null; pausedUntil: Date | null }[]
  > {
    return this.prisma.client.user.findMany({
      where: { morningBriefEnabled: true, suspended: false },
      select: { id: true, currency: true, pausedUntil: true },
    });
  }

  /**
   * Coupons publiés pour un jour, avec la cote 1xBet de leurs jambes quand
   * elle est connue : la ligne « coupons du jour » de la matinée.
   */
  findDayCoupons(day: Date): Promise<DayCoupon[]> {
    return this.prisma.client.couponProposal.findMany({
      where: { forDate: day },
      select: {
        source: true,
        targetOddsMin: true,
        combinedOdds: true,
        legs: { select: { operatorOdds: true } },
      },
      orderBy: { rank: 'asc' },
    });
  }

  /** Joueurs qui reçoivent le relevé du lundi (réglage actif, 2026-10-29). */
  findWeeklyRecipients(): Promise<
    { id: string; currency: string | null; pausedUntil: Date | null }[]
  > {
    return this.prisma.client.user.findMany({
      where: { weeklyStatementEnabled: true, suspended: false },
      select: { id: true, currency: true, pausedUntil: true },
    });
  }

  /** Un relevé par joueur et par semaine, même si le job est relancé. */
  async hasStatement(userId: string, week: string): Promise<boolean> {
    const existing = await this.prisma.client.notification.findFirst({
      where: {
        userId,
        type: NotificationType.WEEKLY_STATEMENT,
        payload: { path: ['week'], equals: week },
      },
      select: { id: true },
    });
    return existing !== null;
  }

  /** Un relancement du job ne doit pas envoyer deux fois le même jour. */
  async hasDigest(userId: string, day: string): Promise<boolean> {
    const existing = await this.prisma.client.notification.findFirst({
      where: {
        userId,
        type: {
          in: [
            NotificationType.SLIPS_SETTLED_DIGEST,
            NotificationType.MORNING_BRIEF,
          ],
        },
        payload: { path: ['day'], equals: day },
      },
      select: { id: true },
    });
    return existing !== null;
  }
}
