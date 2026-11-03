import { Injectable } from '@nestjs/common';
import { FixtureStatus, StatisticSource } from '@evcore/db';
import type {
  MatchEventFact,
  MatchFacts,
  MatchSide,
  TeamStatFact,
} from '@evcore/analysis-core';
import { PrismaService } from '@/prisma.service';

/** fixture_statistic types the phase 3 markets settle on. */
const STAT_TYPES = {
  corners: 'corner_kicks',
  shotsTotal: 'total_shots',
  shotsOn: 'shots_on_goal',
} as const;

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
  events: {
    teamId: string;
    ordinal: number;
    minute: number;
    extraMinute: number | null;
    type: MatchEventFact['type'];
    detail: string;
    comments: string | null;
    playerExternalId: number | null;
    playerName: string | null;
    assistExternalId: number | null;
  }[];
  lineups: { teamId: string; playerExternalId: number; starter: boolean }[];
  playerStatistics: {
    teamId: string;
    playerExternalId: number;
    minutes: number | null;
    shotsTotal: number | null;
    shotsOn: number | null;
  }[];
};

/**
 * The facts of a match as the phase 3 settlement reads them. The score only
 * once the match is finished; events, lineups and player statistics null
 * until reported — events count as reported once `eventsSyncedAt` is set,
 * even with no row (a match without a goal nor a card).
 */
export function matchFactsOf(row: FactsFixtureRow): MatchFacts {
  const sideOf = (teamId: string): MatchSide | null =>
    teamId === row.homeTeamId
      ? 'home'
      : teamId === row.awayTeamId
        ? 'away'
        : null;
  const team = (teamId: string): TeamStatFact => {
    const value = (type: string): number | null => {
      const stat = row.fixtureStatistics.find(
        (entry) => entry.teamId === teamId && entry.type === type,
      );
      return stat === undefined ? null : Number(stat.value.toString());
    };
    return {
      corners: value(STAT_TYPES.corners),
      shotsTotal: value(STAT_TYPES.shotsTotal),
      shotsOn: value(STAT_TYPES.shotsOn),
    };
  };
  const sided = <T extends { teamId: string }>(rows: readonly T[]) =>
    rows.flatMap((entry) => {
      const side = sideOf(entry.teamId);
      return side === null ? [] : [{ ...entry, side }];
    });

  return {
    score:
      row.status === FixtureStatus.FINISHED &&
      row.homeScore !== null &&
      row.awayScore !== null
        ? { home: row.homeScore, away: row.awayScore }
        : null,
    teams: { home: team(row.homeTeamId), away: team(row.awayTeamId) },
    events:
      row.events.length === 0 && row.eventsSyncedAt === null
        ? null
        : row.events.map((event) => ({
            side: sideOf(event.teamId),
            ordinal: event.ordinal,
            minute: event.minute,
            extraMinute: event.extraMinute,
            type: event.type,
            detail: event.detail,
            comments: event.comments,
            playerExternalId: event.playerExternalId,
            playerName: event.playerName,
            assistExternalId: event.assistExternalId,
          })),
    lineups:
      row.lineups.length === 0
        ? null
        : sided(row.lineups).map((entry) => ({
            side: entry.side,
            playerExternalId: entry.playerExternalId,
            starter: entry.starter,
          })),
    playerStats:
      row.playerStatistics.length === 0
        ? null
        : sided(row.playerStatistics).map((entry) => ({
            side: entry.side,
            playerExternalId: entry.playerExternalId,
            minutes: entry.minutes,
            shotsTotal: entry.shotsTotal,
            shotsOn: entry.shotsOn,
          })),
  };
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
            type: { in: Object.values(STAT_TYPES) },
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
