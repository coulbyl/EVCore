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
 * The reads of GET /me (09 § 1). Every one keeps the followed coupons of
 * the products of « Aujourd'hui » (rank 1, a target of `targets`, never the
 * LLM source): the record and the lists cover the same coupons.
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

  /**
   * « 7 coupons gagnés · 4 perdus », the remboursés apart, and the day of
   * the first follow, over the same coupons as the lists.
   */
  async findRecord(input: {
    userId: string;
    targets: readonly number[];
  }): Promise<{
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
      WHERE cf."userId" = ${input.userId}::uuid
        AND cp.source <> 'LLM'
        AND cp.rank = 1
        AND cp."targetOddsMin" = ANY(${input.targets}::numeric[])
    `;
    return row ?? { won: 0, lost: 0, refunded: 0, since: null };
  }
}
