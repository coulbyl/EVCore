import { Injectable } from '@nestjs/common';
import { Fixture, FixtureStatus } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { oneDayWindow } from '@utils/date.utils';

export type FixtureWithTeamNames = Fixture & {
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
};

type FindByDateAndTeamsInput = {
  date: Date;
  homeTeamName: string;
  awayTeamName: string;
  competitionCode?: string;
};

type UpsertCompetitionInput = {
  name: string;
  code: string;
  country: string;
};

type UpsertSeasonInput = {
  competitionId: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

type UpsertTeamInput = {
  externalId: number;
  name: string;
  shortName: string;
  competitionId: string;
};

type UpsertFixtureInput = {
  externalId: number;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  matchday: number;
  scheduledAt: Date;
  status: FixtureStatus;
  homeScore?: number | null;
  awayScore?: number | null;
};

type UpsertOneXTwoOddsSnapshotInput = {
  fixtureId: string;
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
};

@Injectable()
export class FixtureRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertCompetition(data: UpsertCompetitionInput): Promise<{ id: string }> {
    return this.prisma.client.competition.upsert({
      where: { code: data.code },
      create: data,
      update: { name: data.name, country: data.country },
      select: { id: true },
    });
  }

  upsertSeason(data: UpsertSeasonInput): Promise<{ id: string }> {
    return this.prisma.client.season.upsert({
      where: {
        competitionId_name: {
          competitionId: data.competitionId,
          name: data.name,
        },
      },
      create: data,
      update: { startDate: data.startDate, endDate: data.endDate },
      select: { id: true },
    });
  }

  upsertTeam(data: UpsertTeamInput): Promise<{ id: string }> {
    return this.prisma.client.team.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: { name: data.name, shortName: data.shortName },
      select: { id: true },
    });
  }

  upsertFixture(data: UpsertFixtureInput): Promise<{ id: string }> {
    return this.prisma.client.fixture.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: {
        matchday: data.matchday,
        scheduledAt: data.scheduledAt,
        status: data.status,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
      },
      select: { id: true },
    });
  }

  async updateScores(
    externalId: number,
    homeScore: number,
    awayScore: number,
  ): Promise<void> {
    await this.prisma.client.fixture.updateMany({
      where: { externalId },
      data: { homeScore, awayScore, status: 'FINISHED' },
    });
  }

  async updateXg(
    externalId: number,
    homeXg: number,
    awayXg: number,
  ): Promise<void> {
    await this.prisma.client.fixture.update({
      where: { externalId },
      data: { homeXg, awayXg },
    });
  }

  findByExternalId(externalId: number): Promise<Fixture | null> {
    return this.prisma.client.fixture.findUnique({ where: { externalId } });
  }

  findFinishedBySeason(seasonId: string): Promise<Fixture[]> {
    return this.prisma.client.fixture.findMany({
      where: { seasonId, status: 'FINISHED' },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  findScheduledForDate(
    date: Date,
  ): Promise<{ id: string; externalId: number }[]> {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    return this.prisma.client.fixture.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { gte: start, lte: end } },
      select: { id: true, externalId: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  findFinishedWithoutXg(seasonId: string): Promise<{ externalId: number }[]> {
    return this.prisma.client.fixture.findMany({
      where: {
        seasonId,
        status: 'FINISHED',
        homeXg: null,
        xgUnavailable: false,
      },
      select: { externalId: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async markXgUnavailable(externalId: number): Promise<void> {
    await this.prisma.client.fixture.updateMany({
      where: { externalId },
      data: { xgUnavailable: true },
    });
  }

  async upsertOneXTwoOddsSnapshot(
    data: UpsertOneXTwoOddsSnapshotInput,
  ): Promise<{ id: string }> {
    const existing = await this.prisma.client.oddsSnapshot.findFirst({
      where: {
        fixtureId: data.fixtureId,
        bookmaker: data.bookmaker,
        market: 'ONE_X_TWO',
        snapshotAt: data.snapshotAt,
      },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.client.oddsSnapshot.update({
        where: { id: existing.id },
        data: {
          homeOdds: data.homeOdds,
          drawOdds: data.drawOdds,
          awayOdds: data.awayOdds,
        },
        select: { id: true },
      });
    }

    return this.prisma.client.oddsSnapshot.create({
      data: {
        fixtureId: data.fixtureId,
        bookmaker: data.bookmaker,
        market: 'ONE_X_TWO',
        snapshotAt: data.snapshotAt,
        homeOdds: data.homeOdds,
        drawOdds: data.drawOdds,
        awayOdds: data.awayOdds,
      },
      select: { id: true },
    });
  }

  // Used by xg-sync to match Understat entries to DB fixtures via date (±1 day) + team names.
  async findByDateAndTeams(
    input: FindByDateAndTeamsInput,
  ): Promise<FixtureWithTeamNames | null> {
    const { date, homeTeamName, awayTeamName, competitionCode } = input;
    const { from, to } = oneDayWindow(date);

    const candidates = await this.prisma.client.fixture.findMany({
      where: {
        scheduledAt: { gte: from, lte: to },
        ...(competitionCode
          ? { season: { competition: { code: competitionCode } } }
          : {}),
      },
      include: {
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
    });

    return (
      candidates.find(
        (f) =>
          normalizeTeamName(f.homeTeam.name) ===
            normalizeTeamName(homeTeamName) &&
          normalizeTeamName(f.awayTeam.name) ===
            normalizeTeamName(awayTeamName),
      ) ?? null
    );
  }
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(fc|afc|cf|sc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
