import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
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

/** A product's day as stored for « Résultats ». */
export type ProductDayRow = {
  product: string;
  forDate: Date;
  couponProposalId: string;
  outcome: 'won' | 'lost' | 'refunded' | 'pending';
  chance: Prisma.Decimal | null;
  paidOdds: Prisma.Decimal | null;
  priced: boolean;
  label: string;
  market: string | null;
  pick: string | null;
};

/**
 * product_day (docs/refonte-ui/16 § 3): « Résultats » reads these
 * aggregates, never the coupons themselves; they are rewritten from the
 * coupons at each settlement pass.
 */
@Injectable()
export class ProductDayRepository {
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
   * Writes the days in one statement, replacing what a product had that day:
   * replayed by every settlement pass, a correction (won then refunded)
   * overwrites, nothing is ever counted twice.
   */
  async upsertDays(days: readonly ProductDayRow[]): Promise<number> {
    if (days.length === 0) return 0;
    const decimal = (value: Prisma.Decimal | null) =>
      value === null ? null : value.toString();
    return this.prisma.client.$executeRaw`
      INSERT INTO public.product_day
        (product, "forDate", "couponProposalId", outcome, chance, "paidOdds",
         priced, label, market, pick, "updatedAt")
      SELECT d.product, d."forDate", d."couponProposalId", d.outcome,
             d.chance, d."paidOdds", d.priced, d.label, d.market, d.pick, now()
      FROM unnest(
        ${days.map((d) => d.product)}::text[],
        ${days.map((d) => d.forDate)}::date[],
        ${days.map((d) => d.couponProposalId)}::uuid[],
        ${days.map((d) => d.outcome)}::text[],
        ${days.map((d) => decimal(d.chance))}::numeric[],
        ${days.map((d) => decimal(d.paidOdds))}::numeric[],
        ${days.map((d) => d.priced)}::boolean[],
        ${days.map((d) => d.label)}::text[],
        ${days.map((d) => d.market)}::text[],
        ${days.map((d) => d.pick)}::text[]
      ) AS d(product, "forDate", "couponProposalId", outcome, chance,
             "paidOdds", priced, label, market, pick)
      ON CONFLICT (product, "forDate") DO UPDATE SET
        "couponProposalId" = EXCLUDED."couponProposalId",
        outcome = EXCLUDED.outcome,
        chance = EXCLUDED.chance,
        "paidOdds" = EXCLUDED."paidOdds",
        priced = EXCLUDED.priced,
        label = EXCLUDED.label,
        market = EXCLUDED.market,
        pick = EXCLUDED.pick,
        "updatedAt" = now()
    `;
  }

  /**
   * The stored days of these products from `since` on, before `until` when
   * given, oldest first.
   */
  findDays(input: {
    since: Date;
    until?: Date;
    products: readonly string[];
  }): Promise<ProductDayRow[]> {
    return this.prisma.client.$queryRaw<ProductDayRow[]>`
      SELECT product, "forDate", "couponProposalId", outcome, chance,
             "paidOdds", priced, label, market, pick
      FROM public.product_day
      WHERE product = ANY(${input.products}::text[])
        AND "forDate" >= ${input.since}::date
        ${input.until ? Prisma.sql`AND "forDate" < ${input.until}::date` : Prisma.empty}
      ORDER BY "forDate", product
    `;
  }
}
