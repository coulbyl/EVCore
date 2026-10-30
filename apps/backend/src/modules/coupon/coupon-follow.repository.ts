import { Injectable } from '@nestjs/common';
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
   * pas encore réglé n'est compté nulle part.
   */
  async summaryFor(userId: string): Promise<{
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
    `;
    return row ?? { won: 0, lost: 0, refunded: 0, since: null };
  }
}
