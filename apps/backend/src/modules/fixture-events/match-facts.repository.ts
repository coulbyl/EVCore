import { Injectable } from '@nestjs/common';
import { FixtureStatus, StatisticSource } from '@evcore/db';
import {
  buildMatchFacts,
  MATCH_FACT_STAT_TYPES,
  type MatchFacts,
  type MatchFactsRows,
} from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

type FactsFixtureRow = {
  id: string;
  status: FixtureStatus;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  eventsSyncedAt: Date | null;
  fixtureStatistics: {
    teamId: string;
    type: string;
    value: { toString(): string };
  }[];
  events: MatchFactsRows['events'][number][];
  lineups: MatchFactsRows['lineups'][number][];
  playerStatistics: MatchFactsRows['playerStatistics'][number][];
};

/** The facts of a stored match (rules in buildMatchFacts). */
export function matchFactsOf(row: FactsFixtureRow): MatchFacts {
  return buildMatchFacts({
    finished: row.status === FixtureStatus.FINISHED,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    eventsReported: row.eventsSyncedAt !== null,
    statistics: row.fixtureStatistics.map((stat) => ({
      teamId: stat.teamId,
      type: stat.type,
      value: Number(stat.value.toString()),
    })),
    events: row.events,
    lineups: row.lineups,
    playerStatistics: row.playerStatistics,
  });
}

@Injectable()
export class MatchFactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The facts of each fixture found, by fixture id. */
  async findFacts(
    fixtureIds: readonly string[],
  ): Promise<Map<string, MatchFacts>> {
    if (fixtureIds.length === 0) return new Map();
    const rows: FactsFixtureRow[] = await this.prisma.client.fixture.findMany({
      where: { id: { in: [...fixtureIds] } },
      select: {
        id: true,
        status: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        eventsSyncedAt: true,
        fixtureStatistics: {
          where: {
            type: { in: Object.values(MATCH_FACT_STAT_TYPES) },
            source: StatisticSource.API_FOOTBALL,
          },
          select: { teamId: true, type: true, value: true },
        },
        events: {
          select: {
            teamId: true,
            ordinal: true,
            minute: true,
            extraMinute: true,
            type: true,
            detail: true,
            comments: true,
            playerExternalId: true,
            playerName: true,
            assistExternalId: true,
          },
        },
        lineups: {
          select: { teamId: true, playerExternalId: true, starter: true },
        },
        playerStatistics: {
          select: {
            teamId: true,
            playerExternalId: true,
            minutes: true,
            shotsTotal: true,
            shotsOn: true,
          },
        },
      },
    });
    return new Map(rows.map((row) => [row.id, matchFactsOf(row)]));
  }
}
