import { Injectable } from '@nestjs/common';
import type { Fixture } from '@evcore/db';
import { FixtureStatus, Prisma } from '@evcore/db';
import Decimal from 'decimal.js';
import pino from 'pino';
import { ETL_CONSTANTS } from '../../config/etl.constants';
import { PrismaService } from '../../prisma.service';

const RECENT_FORM_DECAY = new Decimal(0.8);
const MAX_RECENT_FORM_MATCHES = 5;
const MAX_ROLLING_XG_MATCHES = 10;
const logger = pino({ name: 'rolling-stats-service' });

export type MatchResult = 'W' | 'D' | 'L';

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
  ): Promise<{ seasonId: string; fixtureCount: number; upsertCount: number }> {
    const season = await this.prisma.client.season.findFirst({
      where: {
        name: seasonName(year),
        competition: { code: ETL_CONSTANTS.EPL_COMPETITION_CODE },
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
      year: number;
      seasonId: string;
      fixtureCount: number;
      upsertCount: number;
    }>
  > {
    const results: Array<{
      year: number;
      seasonId: string;
      fixtureCount: number;
      upsertCount: number;
    }> = [];

    for (const year of ETL_CONSTANTS.EPL_SEASONS) {
      const result = await this.backfillSeasonYear(year);
      results.push({ year, ...result });
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

function toPrismaDecimal(value: Decimal, decimals: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(decimals));
}

function seasonName(year: number): string {
  return `${year}-${String(year + 1).slice(-2)}`;
}

export function calculateRecentForm(results: MatchResult[]): Decimal {
  const lastFive = results.slice(-MAX_RECENT_FORM_MATCHES).reverse();

  if (lastFive.length === 0) {
    return new Decimal(0);
  }

  const weightedPoints = lastFive.reduce((sum, result, i) => {
    const weight = RECENT_FORM_DECAY.pow(i);
    const points = result === 'W' ? 3 : result === 'D' ? 1 : 0;
    return sum.plus(weight.times(points));
  }, new Decimal(0));

  const maxPossible = lastFive.reduce(
    (sum, _result, i) => sum.plus(RECENT_FORM_DECAY.pow(i).times(3)),
    new Decimal(0),
  );

  return weightedPoints.div(maxPossible);
}

export function calculateRollingXg(
  fixtures: Fixture[],
  teamId: string,
): { xgFor: Decimal; xgAgainst: Decimal } {
  const withXg = fixtures.filter(
    (fixture) => fixture.homeXg !== null && fixture.awayXg !== null,
  );
  const lastTen = withXg.slice(-MAX_ROLLING_XG_MATCHES);

  if (lastTen.length === 0) {
    return { xgFor: new Decimal(0), xgAgainst: new Decimal(0) };
  }

  const totals = lastTen.reduce(
    (acc, fixture) => {
      const isHome = fixture.homeTeamId === teamId;
      const xgFor = new Decimal(
        isHome ? (fixture.homeXg ?? 0) : (fixture.awayXg ?? 0),
      );
      const xgAgainst = new Decimal(
        isHome ? (fixture.awayXg ?? 0) : (fixture.homeXg ?? 0),
      );

      return {
        for: acc.for.plus(xgFor),
        against: acc.against.plus(xgAgainst),
      };
    },
    { for: new Decimal(0), against: new Decimal(0) },
  );

  return {
    xgFor: totals.for.div(lastTen.length),
    xgAgainst: totals.against.div(lastTen.length),
  };
}

export function calculateDomExtPerf(
  fixtures: Fixture[],
  teamId: string,
): { homeWinRate: Decimal; awayWinRate: Decimal; drawRate: Decimal } {
  const withScore = fixtures.filter(
    (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
  );

  const home = withScore.filter((fixture) => fixture.homeTeamId === teamId);
  const away = withScore.filter((fixture) => fixture.awayTeamId === teamId);

  const homeWins = home.filter(
    (fixture) => (fixture.homeScore ?? 0) > (fixture.awayScore ?? 0),
  ).length;
  const awayWins = away.filter(
    (fixture) => (fixture.awayScore ?? 0) > (fixture.homeScore ?? 0),
  ).length;
  const draws = withScore.filter(
    (fixture) => (fixture.homeScore ?? 0) === (fixture.awayScore ?? 0),
  ).length;

  return {
    homeWinRate:
      home.length > 0 ? new Decimal(homeWins).div(home.length) : new Decimal(0),
    awayWinRate:
      away.length > 0 ? new Decimal(awayWins).div(away.length) : new Decimal(0),
    drawRate:
      withScore.length > 0
        ? new Decimal(draws).div(withScore.length)
        : new Decimal(0),
  };
}

export function calculateLeagueVolatility(fixtures: Fixture[]): Decimal {
  const totals = fixtures
    .filter(
      (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
    )
    .map((fixture) =>
      new Decimal(fixture.homeScore ?? 0).plus(fixture.awayScore ?? 0),
    );

  if (totals.length < 2) {
    return new Decimal(0);
  }

  const mean = totals
    .reduce((sum, total) => sum.plus(total), new Decimal(0))
    .div(totals.length);

  const variance = totals
    .reduce((sum, total) => sum.plus(total.minus(mean).pow(2)), new Decimal(0))
    .div(totals.length);

  return variance.sqrt();
}

function resultForTeam(fixture: Fixture, teamId: string): MatchResult | null {
  if (fixture.homeScore === null || fixture.awayScore === null) {
    return null;
  }

  if (fixture.homeTeamId === teamId) {
    if (fixture.homeScore > fixture.awayScore) return 'W';
    if (fixture.homeScore < fixture.awayScore) return 'L';
    return 'D';
  }

  if (fixture.awayTeamId === teamId) {
    if (fixture.awayScore > fixture.homeScore) return 'W';
    if (fixture.awayScore < fixture.homeScore) return 'L';
    return 'D';
  }

  return null;
}
