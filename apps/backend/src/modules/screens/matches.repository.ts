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

/** The match of a sheet, with its last meetings (home side's view). */
export type SheetHeaderRow = MatchRow & {
  homeTeamId: string;
  awayTeamId: string;
  homeHalfTimeScore: number | null;
  awayHalfTimeScore: number | null;
  /** Last finished meetings, most recent first: goals of this sheet's home and away teams. */
  meetings: { homeGoals: number; awayGoals: number }[] | null;
};

/** The AI's latest decision before kick-off on one match. */
export type AiOpinionRow = {
  status: string;
  text: string | null;
  market: string | null;
  pick: string | null;
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

  /**
   * One match for its sheet, with the last `meetings` finished meetings of
   * its two teams (either venue) over `since`..kick-off, in one query.
   */
  async findSheetHeader(input: {
    fixtureId: string;
    meetings: number;
    since: Date;
  }): Promise<SheetHeaderRow | null> {
    const [row] = await this.prisma.client.$queryRaw<SheetHeaderRow[]>`
      SELECT f.id AS "fixtureId", f."scheduledAt", f.status::text AS status,
             f."homeScore", f."awayScore",
             f."homeHtScore" AS "homeHalfTimeScore",
             f."awayHtScore" AS "awayHalfTimeScore",
             f."homeTeamId", f."awayTeamId",
             ht.name AS "homeName", ht."shortName" AS "homeShortName",
             ht."logoUrl" AS "homeLogoUrl",
             at.name AS "awayName", at."shortName" AS "awayShortName",
             at."logoUrl" AS "awayLogoUrl",
             c.code AS "competitionCode", c.name AS "competitionName",
             0 AS "leagueRank",
             (
               SELECT json_agg(m ORDER BY m."scheduledAt" DESC)
               FROM (
                 SELECT p."scheduledAt",
                        CASE WHEN p."homeTeamId" = f."homeTeamId"
                             THEN p."homeScore" ELSE p."awayScore" END AS "homeGoals",
                        CASE WHEN p."homeTeamId" = f."homeTeamId"
                             THEN p."awayScore" ELSE p."homeScore" END AS "awayGoals"
                 FROM public.fixture p
                 WHERE p.status = 'FINISHED'
                   AND p."homeScore" IS NOT NULL AND p."awayScore" IS NOT NULL
                   AND p."scheduledAt" < f."scheduledAt"
                   AND p."scheduledAt" >= ${input.since}
                   AND (
                     (p."homeTeamId" = f."homeTeamId" AND p."awayTeamId" = f."awayTeamId")
                     OR (p."homeTeamId" = f."awayTeamId" AND p."awayTeamId" = f."homeTeamId")
                   )
                 ORDER BY p."scheduledAt" DESC
                 LIMIT ${input.meetings}
               ) m
             ) AS meetings
      FROM public.fixture f
      JOIN public.team ht ON ht.id = f."homeTeamId"
      JOIN public.team at ON at.id = f."awayTeamId"
      JOIN public.season s ON s.id = f."seasonId"
      JOIN public.competition c ON c.id = s."competitionId"
      WHERE f.id = ${input.fixtureId}::uuid
    `;
    return row ?? null;
  }

  /**
   * The AI's (VANTAGE) latest decision before kick-off on a match, its text
   * and its pick. Nothing when it never looked at the match.
   */
  findAiOpinion(fixtureId: string): Promise<AiOpinionRow[]> {
    return this.prisma.client.$queryRaw<AiOpinionRow[]>`
      WITH latest AS (
        SELECT cd.id, cd.status::text AS status,
               cd."reasonDetails"->>'text' AS text
        FROM public.channel_decision cd
        JOIN public.model_run mr ON mr.id = cd."modelRunId"
        JOIN public.fixture f ON f.id = mr."fixtureId"
        WHERE mr."fixtureId" = ${fixtureId}::uuid
          AND cd.channel = 'VANTAGE'
          AND cd."createdAt" < f."scheduledAt"
        ORDER BY cd."createdAt" DESC
        LIMIT 1
      )
      SELECT latest.status, latest.text, cs.market::text AS market, cs.pick,
             cs.result::text AS result
      FROM latest
      LEFT JOIN public.channel_selection cs
        ON cs."channelDecisionId" = latest.id AND cs.rank = 1
    `;
  }

  /** Kick-off and status of the matches of a ticket (refonte 07 § 4). */
  findTicketFixtures(
    fixtureIds: readonly string[],
  ): Promise<{ id: string; scheduledAt: Date; status: string }[]> {
    return this.prisma.client.fixture.findMany({
      where: { id: { in: [...fixtureIds] } },
      select: { id: true, scheduledAt: true, status: true },
    });
  }
}
