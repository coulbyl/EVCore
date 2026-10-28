import { Injectable } from '@nestjs/common';
import {
  type BetSlipType,
  type BetStatus,
  type CouponResult,
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
        type: NotificationType.SLIPS_SETTLED_DIGEST,
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

  /** Un relancement du job ne doit pas envoyer deux fois le même jour. */
  async hasDigest(userId: string, day: string): Promise<boolean> {
    const existing = await this.prisma.client.notification.findFirst({
      where: {
        userId,
        type: NotificationType.SLIPS_SETTLED_DIGEST,
        payload: { path: ['day'], equals: day },
      },
      select: { id: true },
    });
    return existing !== null;
  }
}
