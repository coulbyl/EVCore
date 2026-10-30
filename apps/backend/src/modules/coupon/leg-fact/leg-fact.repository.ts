import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { startOfUtcDay } from '@utils/date.utils';

/** A deterministic leg of the day that has no fact yet, with its teams. */
export type LegWithoutFact = {
  legId: string;
  market: string;
  pick: string;
  line: Prisma.Decimal | null;
  homeTeamId: string;
  homeName: string;
  homeShortName: string;
  awayTeamId: string;
  awayName: string;
  awayShortName: string;
};

/** A finished match of a team, seen from that team. */
export type TeamMatchRow = {
  teamId: string;
  atHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  halfTimeFor: number | null;
  halfTimeAgainst: number | null;
  /** Both sides' corners; null unless both were collected. */
  corners: Prisma.Decimal | null;
};

@Injectable()
export class LegFactRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Legs of the day's deterministic coupons whose fact was never computed.
   * The LLM's legs are left out: a fact is the engine's, never the LLM's
   * (04 § 1).
   */
  findLegsWithoutFact(forDate: Date): Promise<LegWithoutFact[]> {
    return this.prisma.client.$queryRaw<LegWithoutFact[]>`
      SELECT l.id AS "legId", l.market::text AS market, l.pick, l.line,
             f."homeTeamId", ht.name AS "homeName",
             ht."shortName" AS "homeShortName",
             f."awayTeamId", at.name AS "awayName",
             at."shortName" AS "awayShortName"
      FROM public.coupon_proposal cp
      JOIN public.coupon_proposal_leg l ON l."couponProposalId" = cp.id
      JOIN public.fixture f ON f.id = l."fixtureId"
      JOIN public.team ht ON ht.id = f."homeTeamId"
      JOIN public.team at ON at.id = f."awayTeamId"
      WHERE cp."forDate" = ${startOfUtcDay(forDate)}::date
        AND cp.source <> 'LLM'
        AND l.fact IS NULL
    `;
  }

  /**
   * The latest finished matches of each team at each venue over
   * [since, before[, most recent first, `perVenue` at most. Home and away
   * are read apart so each side uses its team index.
   */
  findTeamHistories(input: {
    teamIds: readonly string[];
    since: Date;
    before: Date;
    perVenue: number;
  }): Promise<TeamMatchRow[]> {
    return this.prisma.client.$queryRaw<TeamMatchRow[]>`
      WITH played AS (
        SELECT f."homeTeamId" AS "teamId", true AS "atHome", f.id,
               f."scheduledAt", f."homeScore" AS "goalsFor",
               f."awayScore" AS "goalsAgainst",
               f."homeHtScore" AS "halfTimeFor",
               f."awayHtScore" AS "halfTimeAgainst"
        FROM public.fixture f
        WHERE f."homeTeamId" = ANY(${input.teamIds}::uuid[])
          AND f.status = 'FINISHED'
          AND f."homeScore" IS NOT NULL AND f."awayScore" IS NOT NULL
          AND f."scheduledAt" >= ${input.since}
          AND f."scheduledAt" < ${input.before}
        UNION ALL
        SELECT f."awayTeamId", false, f.id, f."scheduledAt",
               f."awayScore", f."homeScore", f."awayHtScore", f."homeHtScore"
        FROM public.fixture f
        WHERE f."awayTeamId" = ANY(${input.teamIds}::uuid[])
          AND f.status = 'FINISHED'
          AND f."homeScore" IS NOT NULL AND f."awayScore" IS NOT NULL
          AND f."scheduledAt" >= ${input.since}
          AND f."scheduledAt" < ${input.before}
      ), latest AS (
        SELECT *, row_number() OVER (
                    PARTITION BY "teamId", "atHome"
                    ORDER BY "scheduledAt" DESC, id
                  ) AS rn
        FROM played
      )
      SELECT latest."teamId", latest."atHome", latest."goalsFor",
             latest."goalsAgainst", latest."halfTimeFor",
             latest."halfTimeAgainst", corners.total AS corners
      FROM latest
      LEFT JOIN LATERAL (
        SELECT sum(fs.value) AS total
        FROM public.fixture_statistic fs
        WHERE fs."fixtureId" = latest.id AND fs.type = 'corner_kicks'
        HAVING count(DISTINCT fs."teamId") = 2
      ) corners ON true
      WHERE latest.rn <= ${input.perVenue}
      ORDER BY latest."teamId", latest."atHome", latest."scheduledAt" DESC
    `;
  }

  /**
   * Writes each leg's fact in one statement, only where none was written: a
   * fact never changes after the fact (04 § 1).
   */
  async saveFacts(
    facts: readonly { legId: string; fact: string }[],
  ): Promise<number> {
    if (facts.length === 0) return 0;
    return this.prisma.client.$executeRaw`
      UPDATE public.coupon_proposal_leg l
      SET fact = v.fact
      FROM unnest(
        ${facts.map((f) => f.legId)}::uuid[],
        ${facts.map((f) => f.fact)}::text[]
      ) AS v(id, fact)
      WHERE l.id = v.id AND l.fact IS NULL
    `;
  }
}
