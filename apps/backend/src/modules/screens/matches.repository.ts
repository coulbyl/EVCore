import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** A match of the day, in screen order. */
export type MatchRow = {
  fixtureId: string;
  scheduledAt: Date;
  status: string;
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
  /** Position in MATCHES_LEAGUE_PRIORITY, 999 when absent: part of the order. */
  leagueRank: number;
};

/** Where the next page starts: the last row's sort key. */
export type MatchesCursor = {
  scheduledAt: string;
  leagueRank: number;
  competitionName: string;
  fixtureId: string;
};

/**
 * A pick of the engine's latest analysis before kick-off. `market` is null
 * on the row that only says the analysis exists (no eligible pick).
 */
export type ReadingCandidateRow = {
  fixtureId: string;
  avoided: boolean;
  channel: string | null;
  market: string | null;
  pick: string | null;
  probability: Prisma.Decimal | null;
  result: 'PENDING' | 'WON' | 'LOST' | 'VOID' | null;
};

/**
 * The reads of GET /matches (16 § 3): a page of the day's matches and the
 * engine's picks for that page. Raw SQL, each read bounded by the page.
 */
@Injectable()
export class MatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Matches kicking off in [from, to[, by kick-off, then the big
   * competitions, then competition name; keyset after `after`. `search`
   * filters on either team's name.
   */
  findDayPage(input: {
    from: Date;
    to: Date;
    search: string | null;
    after: MatchesCursor | null;
    limit: number;
    leaguePriority: readonly string[];
  }): Promise<MatchRow[]> {
    const pattern = input.search
      ? `%${input.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      : null;
    const after = input.after;
    return this.prisma.client.$queryRaw<MatchRow[]>`
      SELECT * FROM (
        SELECT f.id AS "fixtureId", f."scheduledAt", f.status::text AS status,
               f."homeScore", f."awayScore",
               ht.name AS "homeName", ht."shortName" AS "homeShortName",
               ht."logoUrl" AS "homeLogoUrl",
               at.name AS "awayName", at."shortName" AS "awayShortName",
               at."logoUrl" AS "awayLogoUrl",
               c.code AS "competitionCode", c.name AS "competitionName",
               coalesce(
                 array_position(${input.leaguePriority}::text[], c.code),
                 999
               )::int AS "leagueRank"
        FROM public.fixture f
        JOIN public.team ht ON ht.id = f."homeTeamId"
        JOIN public.team at ON at.id = f."awayTeamId"
        JOIN public.season s ON s.id = f."seasonId"
        JOIN public.competition c ON c.id = s."competitionId"
        WHERE f."scheduledAt" >= ${input.from}
          AND f."scheduledAt" < ${input.to}
          ${
            pattern
              ? Prisma.sql`AND (ht.name ILIKE ${pattern} OR at.name ILIKE ${pattern})`
              : Prisma.empty
          }
      ) day
      ${
        after
          ? Prisma.sql`WHERE (day."scheduledAt", day."leagueRank", day."competitionName", day."fixtureId")
              > (${new Date(after.scheduledAt)}, ${after.leagueRank}, ${after.competitionName}, ${after.fixtureId}::uuid)`
          : Prisma.empty
      }
      ORDER BY day."scheduledAt", day."leagueRank", day."competitionName",
               day."fixtureId"
      LIMIT ${input.limit}
    `;
  }

  /**
   * The picks of each match's latest analysis before kick-off, on the
   * channels a player sees, rank 1, markets not suspended. A match analysed
   * without any such pick still has one row (market null); a match never
   * analysed has none. `avoided`: the AVOID channel fired on that analysis.
   */
  findReadingCandidates(input: {
    fixtureIds: readonly string[];
    channels: readonly string[];
  }): Promise<ReadingCandidateRow[]> {
    if (input.fixtureIds.length === 0) return Promise.resolve([]);
    return this.prisma.client.$queryRaw<ReadingCandidateRow[]>`
      WITH runs AS (
        SELECT DISTINCT ON (mr."fixtureId") mr."fixtureId", mr.id
        FROM public.model_run mr
        JOIN public.fixture f ON f.id = mr."fixtureId"
        WHERE mr."fixtureId" = ANY(${input.fixtureIds}::uuid[])
          AND mr."analyzedAt" < f."scheduledAt"
        ORDER BY mr."fixtureId", mr."analyzedAt" DESC
      )
      SELECT r."fixtureId",
             EXISTS (
               SELECT 1 FROM public.channel_decision a
               WHERE a."modelRunId" = r.id AND a.channel = 'AVOID'
                 AND a.status = 'SELECTED'
             ) AS avoided,
             picks.channel, picks.market, picks.pick, picks.probability,
             picks.result
      FROM runs r
      LEFT JOIN LATERAL (
        SELECT cd.channel::text AS channel, cs.market::text AS market,
               cs.pick, cs.probability, cs.result::text AS result
        FROM public.channel_decision cd
        JOIN public.channel_selection cs ON cs."channelDecisionId" = cd.id
        WHERE cd."modelRunId" = r.id
          AND cd.status = 'SELECTED'
          AND cd.channel::text = ANY(${input.channels}::text[])
          AND cs.rank = 1
          AND NOT EXISTS (
            SELECT 1 FROM calibration.market_suspension ms
            WHERE ms.market = cs.market AND ms.active
          )
      ) picks ON true
    `;
  }
}
