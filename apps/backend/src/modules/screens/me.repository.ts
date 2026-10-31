import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** Where a page of settled followed coupons resumes: the last one shown. */
export type MeSettledCursor = { lastKickoffAt: Date; couponId: string };

export type MeFollowedRow = {
  couponId: string;
  lastKickoffAt: Date;
  settled: boolean;
};

/**
 * The followed coupons of GET /me (09 § 1): those of the products of
 * « Aujourd'hui » (isTodayCoupon), as the record
 * (CouponFollowRepository.summaryFor) counts them.
 */
@Injectable()
export class MeRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The followed coupons still running, all of them, and one page of the
   * settled ones, most recent last match first.
   */
  findFollowed(input: {
    userId: string;
    targets: readonly number[];
    settledLimit: number;
    after: MeSettledCursor | null;
    withInProgress: boolean;
  }): Promise<MeFollowedRow[]> {
    const followed = Prisma.sql`
      FROM public.coupon_follow cf
      JOIN public.coupon_proposal cp ON cp.id = cf."couponProposalId"
      WHERE cf."userId" = ${input.userId}::uuid
        AND cp.source <> 'LLM'
        AND cp.rank = 1
        AND cp."targetOddsMin" = ANY(${input.targets}::numeric[])
    `;
    const after = input.after
      ? Prisma.sql`AND (cp."lastFixtureScheduledAt", cp.id)
                     < (${input.after.lastKickoffAt}, ${input.after.couponId}::uuid)`
      : Prisma.empty;
    return this.prisma.client.$queryRaw<MeFollowedRow[]>`
      (SELECT cp.id AS "couponId", cp."lastFixtureScheduledAt" AS "lastKickoffAt",
              false AS settled
       ${followed}
         AND cp.result IS NULL
         AND ${input.withInProgress})
      UNION ALL
      (SELECT cp.id, cp."lastFixtureScheduledAt", true
       ${followed}
         AND cp.result IS NOT NULL
         ${after}
       ORDER BY cp."lastFixtureScheduledAt" DESC, cp.id DESC
       LIMIT ${input.settledLimit})
    `;
  }
}
