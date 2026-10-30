import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** One leg of a coupon of « Aujourd'hui », with its coupon and its match. */
export type TodayLegRow = {
  couponId: string;
  forDate: Date;
  targetOddsMin: Prisma.Decimal;
  combinedOdds: Prisma.Decimal;
  realizedOdds: Prisma.Decimal | null;
  result: 'WON' | 'LOST' | 'PARTIAL' | 'VOID' | null;
  followedByMe: boolean;
  legId: string;
  market: string;
  pick: string;
  line: Prisma.Decimal | null;
  operatorOdds: Prisma.Decimal | null;
  /** Reference price the engine composed on. */
  oddsSnapshot: Prisma.Decimal | null;
  /** The leg's announced probability (the engine's for its own legs). */
  probability: Prisma.Decimal;
  /** Shin's frequency on 1xBet's group, read with operatorOdds. */
  operatorFairProbability: Prisma.Decimal | null;
  /** Null: never computed; empty: nothing solid (CouponLegFactService). */
  fact: string | null;
  isCorrect: boolean | null;
  settledAt: Date | null;
  fixtureId: string;
  scheduledAt: Date;
  fixtureStatus: string;
  homeScore: number | null;
  awayScore: number | null;
  homeName: string;
  homeShortName: string;
  homeLogoUrl: string | null;
  awayName: string;
  awayShortName: string;
  awayLogoUrl: string | null;
  competitionCode: string;
  competitionName: string;
};

/** A past day of a product, for its form and the « Hier » line. */
export type TodayFormRow = {
  forDate: Date;
  targetOddsMin: Prisma.Decimal;
  result: 'WON' | 'LOST' | 'PARTIAL' | 'VOID' | null;
  followedByMe: boolean;
};

/**
 * The columns and joins of a TodayLegRow, shared by GET /today and GET /me.
 * `followedByMe` is read for `userId` (null for a visitor).
 */
function legColumns(userId: string | null): Prisma.Sql {
  return Prisma.sql`
    SELECT cp.id AS "couponId", cp."forDate", cp."targetOddsMin",
           cp."combinedOdds", cp."realizedOdds",
           cp.result::text AS result,
           (cf.id IS NOT NULL) AS "followedByMe",
           l.id AS "legId", l.market::text AS market, l.pick, l.line,
           l."operatorOdds", l."oddsSnapshot", l.probability,
           l."operatorFairProbability", l.fact, l."isCorrect", l."settledAt",
           f.id AS "fixtureId", f."scheduledAt",
           f.status::text AS "fixtureStatus", f."homeScore", f."awayScore",
           ht.name AS "homeName", ht."shortName" AS "homeShortName",
           ht."logoUrl" AS "homeLogoUrl",
           at.name AS "awayName", at."shortName" AS "awayShortName",
           at."logoUrl" AS "awayLogoUrl",
           c.code AS "competitionCode", c.name AS "competitionName"
    FROM public.coupon_proposal cp
    LEFT JOIN public.coupon_follow cf
      ON cf."couponProposalId" = cp.id AND cf."userId" = ${userId}::uuid
    JOIN public.coupon_proposal_leg l ON l."couponProposalId" = cp.id
    JOIN public.fixture f ON f.id = l."fixtureId"
    JOIN public.team ht ON ht.id = f."homeTeamId"
    JOIN public.team at ON at.id = f."awayTeamId"
    JOIN public.season s ON s.id = f."seasonId"
    JOIN public.competition c ON c.id = s."competitionId"
  `;
}

/**
 * The reads of GET /today (16 § 3: at most five SQL queries per screen,
 * none in a loop). Raw SQL on purpose: Prisma's `include` issues one query
 * per relation level, seven here.
 *
 * Every read keeps the deterministic products only: rank 1, a target band
 * of TODAY_PRODUCT_TARGETS, never the LLM source (its combo shares COMBO's
 * band).
 */
@Injectable()
export class TodayRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every leg of today's coupons, plus those of the coupons this player
   * follows from the last days that are not settled yet, oldest kick-off
   * first. One row per leg; `forDate` tells the two sets apart.
   */
  findCouponLegs(input: {
    /** Null for a visitor: nothing is followed. */
    userId: string | null;
    today: Date;
    followedSince: Date;
    targets: readonly number[];
  }): Promise<TodayLegRow[]> {
    return this.prisma.client.$queryRaw<TodayLegRow[]>`
      ${legColumns(input.userId)}
      WHERE cp.source <> 'LLM'
        AND cp.rank = 1
        AND cp."targetOddsMin" = ANY(${input.targets}::numeric[])
        AND (
          cp."forDate" = ${input.today}::date
          OR (
            cf.id IS NOT NULL
            AND cp.result IS NULL
            AND cp."forDate" >= ${input.followedSince}::date
            AND cp."forDate" < ${input.today}::date
          )
        )
      ORDER BY cp."forDate", f."scheduledAt", l.id
    `;
  }

  /** Every leg of the given coupons, as `findCouponLegs` reads them. */
  findCouponLegsByIds(input: {
    userId: string;
    couponIds: readonly string[];
  }): Promise<TodayLegRow[]> {
    if (input.couponIds.length === 0) return Promise.resolve([]);
    return this.prisma.client.$queryRaw<TodayLegRow[]>`
      ${legColumns(input.userId)}
      WHERE cp.id = ANY(${input.couponIds}::uuid[])
      ORDER BY cp."forDate", f."scheduledAt", l.id
    `;
  }

  /**
   * One row per product and day over [since, until[, settled or not: the
   * form strip and the « Hier » line read the same rows.
   */
  findProductDays(input: {
    /** Null for a visitor: nothing is followed. */
    userId: string | null;
    since: Date;
    until: Date;
    targets: readonly number[];
  }): Promise<TodayFormRow[]> {
    return this.prisma.client.$queryRaw<TodayFormRow[]>`
      SELECT cp."forDate", cp."targetOddsMin", cp.result::text AS result,
             EXISTS (
               SELECT 1 FROM public.coupon_follow cf
               WHERE cf."couponProposalId" = cp.id
                 AND cf."userId" = ${input.userId}::uuid
             ) AS "followedByMe"
      FROM public.coupon_proposal cp
      WHERE cp.source <> 'LLM'
        AND cp.rank = 1
        AND cp."targetOddsMin" = ANY(${input.targets}::numeric[])
        AND cp."forDate" >= ${input.since}::date
        AND cp."forDate" < ${input.until}::date
      ORDER BY cp."forDate", cp.id
    `;
  }
}
