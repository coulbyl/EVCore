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
}
