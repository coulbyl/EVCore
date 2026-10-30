import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** « Suivre ce coupon » : une ligne par joueur et par coupon, sans mise. */
@Injectable()
export class CouponFollowRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent : suivre deux fois revient à suivre une fois. */
  async follow(couponProposalId: string, userId: string): Promise<void> {
    await this.prisma.client.couponFollow.upsert({
      where: { couponProposalId_userId: { couponProposalId, userId } },
      create: { couponProposalId, userId },
      update: {},
    });
  }

  async unfollow(couponProposalId: string, userId: string): Promise<void> {
    await this.prisma.client.couponFollow.deleteMany({
      where: { couponProposalId, userId },
    });
  }

  /**
   * Le bilan des coupons suivis d'un joueur (09 § 1) : gagnés (gain partiel
   * compris), perdus, remboursés, et la date du premier suivi. Un coupon
   * pas encore réglé n'est compté nulle part. Avec `range`, les coupons dont
   * le dernier match se joue dans [from, to[, comme le relevé du lundi
   * (« Ta semaine », 08 § 3).
   */
  async summaryFor(
    userId: string,
    range?: { from: Date; to: Date },
  ): Promise<{
    won: number;
    lost: number;
    refunded: number;
    since: Date | null;
  }> {
    const [row] = await this.prisma.client.$queryRaw<
      { won: number; lost: number; refunded: number; since: Date | null }[]
    >`
      SELECT count(*) FILTER (WHERE cp.result IN ('WON', 'PARTIAL'))::int AS won,
             count(*) FILTER (WHERE cp.result = 'LOST')::int AS lost,
             count(*) FILTER (WHERE cp.result = 'VOID')::int AS refunded,
             min(cf."createdAt") AS since
      FROM public.coupon_follow cf
      JOIN public.coupon_proposal cp ON cp.id = cf."couponProposalId"
      WHERE cf."userId" = ${userId}::uuid
        ${
          range
            ? Prisma.sql`AND cp."lastFixtureScheduledAt" >= ${range.from}
                         AND cp."lastFixtureScheduledAt" < ${range.to}`
            : Prisma.empty
        }
    `;
    return row ?? { won: 0, lost: 0, refunded: 0, since: null };
  }
}
