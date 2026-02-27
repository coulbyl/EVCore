import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import pino from 'pino';
import { FixtureStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { TeamStatsInput } from '@modules/betting-engine/betting-engine.types';
import {
  brierScoreOneXTwo,
  calibrationError,
  getOneXTwoOutcome,
  type BacktestReport,
  type CalibrationPoint,
  type OneXTwoPrediction,
} from './backtest.report';

const logger = pino({ name: 'backtest-service' });

type FixtureForBacktest = {
  id: string;
  seasonId: string;
  scheduledAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
};

type TeamStatsIndexEntry = {
  afterFixtureId: string;
  scheduledAt: Date;
  stats: TeamStatsInput;
};

type OneXTwoOdds = {
  home: Decimal;
  draw: Decimal;
  away: Decimal;
};

@Injectable()
export class BacktestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
  ) {}

  async runBacktest(seasonId: string): Promise<BacktestReport> {
    logger.info({ seasonId }, 'Starting backtest');

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        seasonId,
        status: FixtureStatus.FINISHED,
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        id: true,
        seasonId: true,
        scheduledAt: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });

    const teamStatsByTeam = await this.loadTeamStatsIndexForSeason(seasonId);
    const oddsByFixture = await this.loadLatestOneXTwoOddsForFixtures(fixtures);

    const oneXTwoPredictions: OneXTwoPrediction[] = [];
    const calibrationPoints: CalibrationPoint[] = [];
    let analyzedCount = 0;
    let skippedCount = 0;
    let roiProfit = new Decimal(0);
    let roiStake = new Decimal(0);

    for (const fixture of fixtures) {
      if (fixture.homeScore === null || fixture.awayScore === null) {
        skippedCount++;
        continue;
      }

      const homeStats = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.homeTeamId) ?? [],
        fixture,
      );
      const awayStats = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.awayTeamId) ?? [],
        fixture,
      );

      if (!homeStats || !awayStats) {
        skippedCount++;
        continue;
      }

      const computed = this.bettingEngine.computeFromTeamStats(
        homeStats,
        awayStats,
      );
      const actual = getOneXTwoOutcome(fixture.homeScore, fixture.awayScore);

      const home = computed.probabilities.home.toNumber();
      const draw = computed.probabilities.draw.toNumber();
      const away = computed.probabilities.away.toNumber();

      oneXTwoPredictions.push({ home, draw, away, actual });
      calibrationPoints.push(
        { prob: home, actual: actual === 'HOME' ? 1 : 0 },
        { prob: draw, actual: actual === 'DRAW' ? 1 : 0 },
        { prob: away, actual: actual === 'AWAY' ? 1 : 0 },
      );
      analyzedCount++;

      const odds = oddsByFixture.get(fixture.id);
      if (!odds) {
        continue;
      }

      const simulation = simulateOneXTwoBet({ home, draw, away }, odds, actual);
      if (!simulation.placed) {
        continue;
      }

      roiProfit = roiProfit.plus(simulation.profit);
      roiStake = roiStake.plus(1);
    }

    const roiSimulated = roiStake.greaterThan(0)
      ? roiProfit.div(roiStake)
      : new Decimal(0);

    const report: BacktestReport = {
      seasonId,
      fixtureCount: fixtures.length,
      analyzedCount,
      skippedCount,
      brierScore: new Decimal(brierScoreOneXTwo(oneXTwoPredictions)),
      calibrationError: new Decimal(calibrationError(calibrationPoints)),
      roiSimulated,
      reportGeneratedAt: new Date(),
    };

    logger.info(
      {
        seasonId,
        fixtureCount: report.fixtureCount,
        analyzedCount: report.analyzedCount,
        skippedCount: report.skippedCount,
        brierScore: report.brierScore.toNumber(),
        calibrationError: report.calibrationError.toNumber(),
        roiSimulated: report.roiSimulated.toNumber(),
      },
      'Backtest complete',
    );

    return report;
  }

  private async loadTeamStatsIndexForSeason(
    seasonId: string,
  ): Promise<Map<string, TeamStatsIndexEntry[]>> {
    const statsRows = await this.prisma.client.teamStats.findMany({
      where: { afterFixture: { seasonId } },
      select: {
        teamId: true,
        afterFixtureId: true,
        recentForm: true,
        xgFor: true,
        xgAgainst: true,
        homeWinRate: true,
        awayWinRate: true,
        drawRate: true,
        leagueVolatility: true,
        afterFixture: { select: { scheduledAt: true } },
      },
      orderBy: [
        { afterFixture: { scheduledAt: 'asc' } },
        { afterFixtureId: 'asc' },
      ],
    });

    const index = new Map<string, TeamStatsIndexEntry[]>();
    for (const row of statsRows) {
      const list = index.get(row.teamId) ?? [];
      list.push({
        afterFixtureId: row.afterFixtureId,
        scheduledAt: row.afterFixture.scheduledAt,
        stats: {
          recentForm: row.recentForm,
          xgFor: row.xgFor,
          xgAgainst: row.xgAgainst,
          homeWinRate: row.homeWinRate,
          awayWinRate: row.awayWinRate,
          drawRate: row.drawRate,
          leagueVolatility: row.leagueVolatility,
        },
      });
      index.set(row.teamId, list);
    }

    return index;
  }

  private async loadLatestOneXTwoOddsForFixtures(
    fixtures: FixtureForBacktest[],
  ): Promise<Map<string, OneXTwoOdds>> {
    if (fixtures.length === 0) {
      return new Map<string, OneXTwoOdds>();
    }

    const fixtureIds = fixtures.map((fixture) => fixture.id);
    const fixtureById = new Map(
      fixtures.map((fixture) => [fixture.id, fixture]),
    );

    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId: { in: fixtureIds },
        market: Market.ONE_X_TWO,
        homeOdds: { not: null },
        drawOdds: { not: null },
        awayOdds: { not: null },
      },
      select: {
        fixtureId: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
      },
      orderBy: [{ fixtureId: 'asc' }, { snapshotAt: 'desc' }],
    });

    const latest = new Map<string, OneXTwoOdds>();
    for (const row of rows) {
      if (latest.has(row.fixtureId)) {
        continue;
      }
      if (
        row.homeOdds === null ||
        row.drawOdds === null ||
        row.awayOdds === null
      ) {
        continue;
      }

      const fixture = fixtureById.get(row.fixtureId);
      if (!fixture || row.snapshotAt > fixture.scheduledAt) {
        continue;
      }

      latest.set(row.fixtureId, {
        home: row.homeOdds,
        draw: row.drawOdds,
        away: row.awayOdds,
      });
    }

    return latest;
  }
}

function findLatestStatsBeforeFixture(
  stats: TeamStatsIndexEntry[],
  fixture: FixtureForBacktest,
) {
  let lo = 0;
  let hi = stats.length - 1;
  let best = -1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const cmp = compareEntryToFixture(stats[mid], fixture);

    if (cmp < 0) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best >= 0 ? stats[best].stats : null;
}

function compareEntryToFixture(
  entry: TeamStatsIndexEntry,
  fixture: FixtureForBacktest,
): number {
  const entryTs = entry.scheduledAt.getTime();
  const fixtureTs = fixture.scheduledAt.getTime();
  if (entryTs !== fixtureTs) return entryTs - fixtureTs;

  // Same kickoff timestamp: deterministic tie-break to avoid look-ahead bias.
  if (entry.afterFixtureId < fixture.id) return -1;
  if (entry.afterFixtureId > fixture.id) return 1;
  return 0;
}

function simulateOneXTwoBet(
  probabilities: { home: number; draw: number; away: number },
  odds: OneXTwoOdds,
  actual: 'HOME' | 'DRAW' | 'AWAY',
): { placed: boolean; profit: Decimal } {
  const picks: Array<{
    outcome: 'HOME' | 'DRAW' | 'AWAY';
    prob: number;
    odds: Decimal;
  }> = [
    { outcome: 'HOME', prob: probabilities.home, odds: odds.home },
    { outcome: 'DRAW', prob: probabilities.draw, odds: odds.draw },
    { outcome: 'AWAY', prob: probabilities.away, odds: odds.away },
  ];

  const bestPick = picks.reduce((best, current) =>
    current.prob > best.prob ? current : best,
  );
  const ev = new Decimal(bestPick.prob).mul(bestPick.odds).minus(1);

  if (ev.lessThanOrEqualTo(0)) {
    return { placed: false, profit: new Decimal(0) };
  }

  if (bestPick.outcome === actual) {
    return { placed: true, profit: bestPick.odds.minus(1) };
  }

  return { placed: true, profit: new Decimal(-1) };
}
