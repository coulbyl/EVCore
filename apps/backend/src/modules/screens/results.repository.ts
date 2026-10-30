import { Injectable } from '@nestjs/common';
import { type Prisma, vantageCohortSql } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { PricedLeg } from './coupon-chance';

/** One leg of a product's coupon of the day, with its coupon. */
export type ProductLegRow = PricedLeg & {
  couponId: string;
  source: string;
  targetOddsMin: Prisma.Decimal;
  forDate: Date;
  result: 'WON' | 'LOST' | 'PARTIAL' | 'VOID' | null;
  market: string;
  pick: string;
  isCorrect: boolean | null;
  settledAt: Date | null;
  scheduledAt: Date;
  homeName: string;
  awayName: string;
};

/** One settled opinion of the AI, from its frozen history. */
export type AiAdviceRow = {
  kickoff: Date;
  homeName: string;
  awayName: string;
  market: string;
  pick: string;
  odds: Prisma.Decimal;
  probability: Prisma.Decimal | null;
  result: 'WON' | 'LOST' | 'VOID';
  configVersion: string | null;
};

/**
 * The reads of « Résultats » (docs/refonte-ui/08): the products' days and
 * the AI's opinions. Nothing replayed: a day is a coupon published before
 * its first kick-off (08 § 0).
 */
@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The legs of each product's coupon of each day in [since, until]: rank 1,
   * the source and band of a product, published before its first kick-off;
   * when a product published twice that day (the AI's evening and intraday
   * passes), the first one. Legs in kick-off order.
   */
  findProductLegs(input: {
    since: Date;
    until: Date;
    products: readonly { source: string; targetOddsMin: number }[];
  }): Promise<ProductLegRow[]> {
    return this.prisma.client.$queryRaw<ProductLegRow[]>`
      WITH products AS (
        SELECT * FROM unnest(
          ${input.products.map((p) => p.source)}::text[],
          ${input.products.map((p) => p.targetOddsMin)}::numeric[]
        ) AS p(source, target)
      ), days AS (
        SELECT DISTINCT ON (cp.source, cp."targetOddsMin", cp."forDate")
               cp.id, cp.source::text AS source, cp."targetOddsMin",
               cp."forDate", cp.result::text AS result
        FROM public.coupon_proposal cp
        JOIN products p
          ON p.source = cp.source::text AND p.target = cp."targetOddsMin"
        WHERE cp.rank = 1
          AND cp."forDate" >= ${input.since}::date
          AND cp."forDate" <= ${input.until}::date
          AND cp."generatedAt" < (
            SELECT min(f."scheduledAt")
            FROM public.coupon_proposal_leg l
            JOIN public.fixture f ON f.id = l."fixtureId"
            WHERE l."couponProposalId" = cp.id
          )
        ORDER BY cp.source, cp."targetOddsMin", cp."forDate", cp."generatedAt"
      )
      SELECT d.id AS "couponId", d.source, d."targetOddsMin", d."forDate",
             d.result, l.market::text AS market, l.pick, l."operatorOdds",
             l."oddsSnapshot", l.probability, l."operatorFairProbability",
             l."isCorrect", l."settledAt", f."scheduledAt",
             ht.name AS "homeName", at.name AS "awayName"
      FROM days d
      JOIN public.coupon_proposal_leg l ON l."couponProposalId" = d.id
      JOIN public.fixture f ON f.id = l."fixtureId"
      JOIN public.team ht ON ht.id = f."homeTeamId"
      JOIN public.team at ON at.id = f."awayTeamId"
      ORDER BY d."forDate", d.source, d."targetOddsMin", f."scheduledAt", l.id
    `;
  }

  /**
   * The AI's settled opinions on matches of [since, until], read on its
   * frozen history (vantageCohortSql), never the live row (lot 5), most
   * recent first.
   */
  findAiAdvice(input: {
    since: Date;
    until: Date;
    asOf: Date;
  }): Promise<AiAdviceRow[]> {
    return this.prisma.client.$queryRaw<AiAdviceRow[]>`
      WITH cohort AS (
        ${vantageCohortSql({ asOf: input.asOf, since: input.since, until: input.until })}
      )
      SELECT f."scheduledAt" AS kickoff, ht.name AS "homeName",
             at.name AS "awayName", h.market::text AS market, h.pick, h.odds,
             h.probability, h.result::text AS result, h."configVersion"
      FROM cohort c
      JOIN public.vantage_decision_history h ON h.id = c.id
      JOIN public.fixture f ON f.id = h."fixtureId"
      JOIN public.team ht ON ht.id = f."homeTeamId"
      JOIN public.team at ON at.id = f."awayTeamId"
      ORDER BY f."scheduledAt" DESC, h.id
    `;
  }
}
