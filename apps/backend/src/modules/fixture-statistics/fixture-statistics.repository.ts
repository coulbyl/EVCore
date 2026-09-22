import { Injectable } from '@nestjs/common';
import { Prisma, StatisticSource } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { NormalizedFixtureStatistic } from './fixture-statistics.types';

type FixtureTeamIdentity = {
  fixtureId: string;
  teams: ReadonlyMap<number, string>;
};

@Injectable()
export class FixtureStatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFixtureTeamIdentity(
    fixtureExternalId: number,
  ): Promise<FixtureTeamIdentity | null> {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { externalId: fixtureExternalId },
      select: {
        id: true,
        homeTeam: { select: { id: true, externalId: true } },
        awayTeam: { select: { id: true, externalId: true } },
      },
    });
    if (!fixture) return null;
    return {
      fixtureId: fixture.id,
      teams: new Map([
        [fixture.homeTeam.externalId, fixture.homeTeam.id],
        [fixture.awayTeam.externalId, fixture.awayTeam.id],
      ]),
    };
  }

  async replaceFixtureStatistics(input: {
    fixtureId: string;
    observedAt: Date;
    statistics: readonly NormalizedFixtureStatistic[];
  }): Promise<void> {
    const data: Prisma.FixtureStatisticCreateManyInput[] = input.statistics.map(
      (statistic) => ({
        fixtureId: input.fixtureId,
        teamId: statistic.teamId,
        type: statistic.type,
        value: new Prisma.Decimal(statistic.value),
        rawValue: statistic.rawValue,
        source: StatisticSource.API_FOOTBALL,
        observedAt: input.observedAt,
      }),
    );

    await this.prisma.client.$transaction(async (tx) => {
      await tx.fixtureStatistic.deleteMany({
        where: {
          fixtureId: input.fixtureId,
          source: StatisticSource.API_FOOTBALL,
        },
      });
      if (data.length > 0) {
        await tx.fixtureStatistic.createMany({ data });
      }
      await tx.fixture.update({
        where: { id: input.fixtureId },
        data: {
          statisticsSyncedAt: input.observedAt,
          statisticsUnavailable: false,
        },
      });
    });
  }

  async markUnavailable(fixtureExternalId: number): Promise<void> {
    await this.prisma.client.fixture.update({
      where: { externalId: fixtureExternalId },
      data: { statisticsUnavailable: true },
    });
  }
}
