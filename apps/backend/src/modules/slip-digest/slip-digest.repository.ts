import { Injectable } from '@nestjs/common';
import {
  type BetSlipType,
  type BetStatus,
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

function slipIdsOf(payload: Prisma.JsonValue | null): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }
  const ids = payload.slipIds;
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

  /** Coupons déjà annoncés réglés dans un résumé envoyé depuis `since`. */
  async findReportedSlipIds(
    userIds: readonly string[],
    since: Date,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const digests = await this.prisma.client.notification.findMany({
      where: {
        userId: { in: [...userIds] },
        type: NotificationType.SLIPS_SETTLED_DIGEST,
        createdAt: { gte: since },
      },
      select: { payload: true },
    });
    return new Set(digests.flatMap((digest) => slipIdsOf(digest.payload)));
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
