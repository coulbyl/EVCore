import { Injectable } from '@nestjs/common';
import { FixtureStatus } from '@evcore/db';
import Decimal from 'decimal.js';
import pino from 'pino';
import {
  ACTIVE_COMPETITIONS,
  getCompetitionSeasons,
} from '@config/etl.constants';
import { PrismaService } from '@/prisma.service';
import { toPrismaDecimal } from '@utils/prisma.utils';
import { seasonNameFromYear } from '@utils/season.utils';
import {
  calculateRecentForm,
  calculateRollingXg,
  calculateDomExtPerf,
  calculateLeagueVolatility,
  resultForTeam,
  type MatchResult,
} from './rolling-stats.utils';

const logger = pino({ name: 'rolling-stats-service' });

export type FeatureSnapshot = {
  recentForm: Decimal;
  xgFor: Decimal;
  xgAgainst: Decimal;
  homeWinRate: Decimal;
  awayWinRate: Decimal;
  drawRate: Decimal;
  leagueVolatility: Decimal;
};

@Injectable()
export class RollingStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async backfillSeasonYear(
    year: number,
    competitionCode: string,
  ): Promise<{ seasonId: string; fixtureCount: number; upsertCount: number }> {
    const season = await this.prisma.client.season.findFirst({
      where: {
        name: seasonNameFromYear(year),
        competition: { code: competitionCode },
      },
      select: { id: true },
    });

    if (!season) {
      throw new Error(`season not found for year ${year}`);
    }

    return this.backfillSeason(season.id);
  }

  async backfillAllConfiguredSeasons(): Promise<
    Array<{
      competitionCode: string;
      year: number;
      seasonId: string;
      fixtureCount: number;
      upsertCount: number;
    }>
  > {
    const results: Array<{
      competitionCode: string;
      year: number;
      seasonId: string;
      fixtureCount: number;
      upsertCount: number;
    }> = [];

    for (const competition of ACTIVE_COMPETITIONS) {
      const seasons = getCompetitionSeasons(competition);
      for (const year of seasons) {
        const result = await this.backfillSeasonYear(year, competition.code);
        results.push({ competitionCode: competition.code, year, ...result });
      }
    }

    return results;
  }

  async backfillSeason(
    seasonId: string,
  ): Promise<{ seasonId: string; fixtureCount: number; upsertCount: number }> {
    logger.info({ seasonId }, 'Starting rolling-stats backfill');

    const fixtures = await this.prisma.client.fixture.findMany({
      where: { seasonId, status: FixtureStatus.FINISHED },
      select: { id: true, homeTeamId: true, awayTeamId: true },
      orderBy: { scheduledAt: 'asc' },
    });

    let upsertCount = 0;

    for (const fixture of fixtures) {
      await this.computeAndStore(fixture.homeTeamId, fixture.id);
      await this.computeAndStore(fixture.awayTeamId, fixture.id);
      upsertCount += 2;
    }

    logger.info(
      { seasonId, fixtureCount: fixtures.length, upsertCount },
      'Rolling-stats backfill complete',
    );

    return { seasonId, fixtureCount: fixtures.length, upsertCount };
  }

  async computeAndStore(teamId: string, afterFixtureId: string): Promise<void> {
    const stats = await this.computeStats(teamId, afterFixtureId);

    await this.prisma.client.teamStats.upsert({
      where: { teamId_afterFixtureId: { teamId, afterFixtureId } },
      create: {
        teamId,
        afterFixtureId,
        recentForm: toPrismaDecimal(stats.recentForm, 4),
        xgFor: toPrismaDecimal(stats.xgFor, 3),
        xgAgainst: toPrismaDecimal(stats.xgAgainst, 3),
        homeWinRate: toPrismaDecimal(stats.homeWinRate, 4),
        awayWinRate: toPrismaDecimal(stats.awayWinRate, 4),
        drawRate: toPrismaDecimal(stats.drawRate, 4),
        leagueVolatility: toPrismaDecimal(stats.leagueVolatility, 4),
      },
      update: {
        recentForm: toPrismaDecimal(stats.recentForm, 4),
        xgFor: toPrismaDecimal(stats.xgFor, 3),
        xgAgainst: toPrismaDecimal(stats.xgAgainst, 3),
        homeWinRate: toPrismaDecimal(stats.homeWinRate, 4),
        awayWinRate: toPrismaDecimal(stats.awayWinRate, 4),
        drawRate: toPrismaDecimal(stats.drawRate, 4),
        leagueVolatility: toPrismaDecimal(stats.leagueVolatility, 4),
      },
    });
  }

  async computeStats(
    teamId: string,
    afterFixtureId: string,
  ): Promise<FeatureSnapshot> {
    const afterFixture = await this.prisma.client.fixture.findUnique({
      where: { id: afterFixtureId },
      select: { seasonId: true, scheduledAt: true },
    });

    if (!afterFixture) {
      throw new Error(`afterFixture not found: ${afterFixtureId}`);
    }

    const finishedFixtures = await this.prisma.client.fixture.findMany({
      where: {
        seasonId: afterFixture.seasonId,
        status: FixtureStatus.FINISHED,
        scheduledAt: { lte: afterFixture.scheduledAt },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const teamFixtures = finishedFixtures.filter(
      (f) => f.homeTeamId === teamId || f.awayTeamId === teamId,
    );

    const recentResults = teamFixtures
      .map((fixture) => resultForTeam(fixture, teamId))
      .filter((result): result is MatchResult => result !== null);

    const { homeWinRate, awayWinRate, drawRate } = calculateDomExtPerf(
      teamFixtures,
      teamId,
    );

    return {
      recentForm: calculateRecentForm(recentResults),
      ...calculateRollingXg(teamFixtures, teamId),
      homeWinRate,
      awayWinRate,
      drawRate,
      leagueVolatility: calculateLeagueVolatility(finishedFixtures),
    };
  }
}
