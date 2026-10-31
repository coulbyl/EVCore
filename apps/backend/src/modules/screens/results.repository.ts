import { Injectable } from '@nestjs/common';
import { type Prisma, vantageCohortSql } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

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
 * The AI's side of « Résultats » (docs/refonte-ui/08); the products' days
 * are read from product_day (ProductDayRepository).
 */
@Injectable()
export class ResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
