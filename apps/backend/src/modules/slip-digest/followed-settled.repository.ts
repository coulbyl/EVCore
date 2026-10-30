import { Injectable } from '@nestjs/common';
import { NotificationType, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** One leg of a followed coupon settled in the evening, with its follower. */
export type FollowedSettledRow = {
  userId: string;
  pausedUntil: Date | null;
  couponId: string;
  targetOddsMin: Prisma.Decimal;
  source: string;
  result: 'WON' | 'LOST' | 'PARTIAL' | 'VOID';
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: Date;
  isCorrect: boolean | null;
  operatorOdds: Prisma.Decimal | null;
};

@Injectable()
export class FollowedSettledRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Followed coupons whose last settled leg was settled since `since`, one
   * row per follower and leg, legs in kick-off order. `forDateFrom` only
   * bounds the scan: the coupons of the last days are the only ones that
   * can settle tonight.
   */
  findSettledSince(input: {
    since: Date;
    forDateFrom: Date;
  }): Promise<FollowedSettledRow[]> {
    return this.prisma.client.$queryRaw<FollowedSettledRow[]>`
      WITH settled AS (
        SELECT cp.id, cp."targetOddsMin", cp.source::text AS source,
               cp.result::text AS result
        FROM public.coupon_proposal cp
        WHERE cp.result IS NOT NULL
          AND cp."forDate" >= ${input.forDateFrom}::date
          AND EXISTS (
            SELECT 1 FROM public.coupon_follow cf
            WHERE cf."couponProposalId" = cp.id
          )
          AND (
            SELECT max(l."settledAt") FROM public.coupon_proposal_leg l
            WHERE l."couponProposalId" = cp.id
          ) >= ${input.since}
      )
      SELECT cf."userId", u."pausedUntil", s.id AS "couponId",
             s."targetOddsMin", s.source, s.result,
             ht.name AS home, at.name AS away,
             f."homeScore", f."awayScore", f."scheduledAt",
             l."isCorrect", l."operatorOdds"
      FROM settled s
      JOIN public.coupon_follow cf ON cf."couponProposalId" = s.id
      JOIN public.users u ON u.id = cf."userId"
      JOIN public.coupon_proposal_leg l ON l."couponProposalId" = s.id
      JOIN public.fixture f ON f.id = l."fixtureId"
      JOIN public.team ht ON ht.id = f."homeTeamId"
      JOIN public.team at ON at.id = f."awayTeamId"
      -- « Résultat de mes coupons suivis » coupé (09 § 5) : rien ce soir ;
      -- la matinée du lendemain le dit quand même.
      WHERE u."followedResultEnabled"
      ORDER BY cf."userId", s.id, f."scheduledAt", l.id
    `;
  }

  /**
   * « userId:couponId » of every followed coupon already announced since
   * `since`: the notification is the record (docs/review-expectations.md
   * § 4), so a run that crashed half-way, or a second run, sends nothing
   * twice.
   */
  async findAnnounced(input: {
    userIds: readonly string[];
    since: Date;
  }): Promise<Set<string>> {
    if (input.userIds.length === 0) return new Set();
    const rows = await this.prisma.client.notification.findMany({
      where: {
        userId: { in: [...input.userIds] },
        type: NotificationType.FOLLOWED_SETTLED,
        createdAt: { gte: input.since },
      },
      select: { userId: true, payload: true },
    });
    return new Set(
      rows.flatMap((row) => {
        const couponId = couponIdOf(row.payload);
        return row.userId && couponId ? [`${row.userId}:${couponId}`] : [];
      }),
    );
  }
}

function couponIdOf(payload: Prisma.JsonValue | null): string | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const id = payload.couponProposalId;
    return typeof id === 'string' ? id : null;
  }
  return null;
}
