import { Injectable } from '@nestjs/common';
import { Fixture, FixtureStatus } from '@evcore/db';
import { PrismaService } from '../../prisma.service';

export type FixtureWithTeamNames = Fixture & {
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
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

@Injectable()
export class FixtureRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertCompetition(
    data: UpsertCompetitionInput,
  ): Promise<{ id: string }> {
    return this.prisma.client.competition.upsert({
      where: { code: data.code },
      create: data,
      update: { name: data.name, country: data.country },
      select: { id: true },
    });
  }

  async upsertSeason(data: UpsertSeasonInput): Promise<{ id: string }> {
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

  async upsertTeam(data: UpsertTeamInput): Promise<{ id: string }> {
    return this.prisma.client.team.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: { name: data.name, shortName: data.shortName },
      select: { id: true },
    });
  }

  async upsertFixture(data: UpsertFixtureInput): Promise<{ id: string }> {
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
    await this.prisma.client.fixture.update({
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

  async findByExternalId(externalId: number): Promise<Fixture | null> {
    return this.prisma.client.fixture.findUnique({ where: { externalId } });
  }

  async findFinishedBySeason(seasonId: string): Promise<Fixture[]> {
    return this.prisma.client.fixture.findMany({
      where: { seasonId, status: 'FINISHED' },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // Used by xg-sync to match Understat entries to DB fixtures via date (±1 day) + team names.
  async findByDateAndTeams(
    date: Date,
    homeTeamName: string,
    awayTeamName: string,
  ): Promise<FixtureWithTeamNames | null> {
    const dayBefore = new Date(date);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(date);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const candidates = await this.prisma.client.fixture.findMany({
      where: { scheduledAt: { gte: dayBefore, lte: dayAfter } },
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
