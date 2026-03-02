import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import pino from 'pino';
import { FixtureStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { TeamStatsInput } from '@modules/betting-engine/betting-engine.types';
import { EV_THRESHOLD } from '@modules/betting-engine/ev.constants';
import { calculateEV } from '@modules/betting-engine/betting-engine.utils';
import { NotificationService } from '@modules/notification/notification.service';
import { RISK_CONSTANTS } from '@modules/risk/risk.constants';
import {
  brierScoreOneXTwo,
  calibrationError,
  getOneXTwoOutcome,
  type AllSeasonsBacktestReport,
  type BacktestMarketPerformance,
  type BacktestReport,
  type CalibrationPoint,
  type MetricResult,
  type OneXTwoPrediction,
  type ValidationReport,
  type ValidationVerdict,
} from './backtest.report';
import { BACKTEST_CONSTANTS } from './backtest.constants';

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

type MarketAccumulator = {
  market: Market;
  betsPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  stake: Decimal;
  profit: Decimal;
  evTotal: Decimal;
  equity: Decimal;
  equityPeak: Decimal;
  maxDrawdown: Decimal;
};

@Injectable()
export class BacktestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
    private readonly notification: NotificationService,
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
    let evTotal = new Decimal(0);
    let evCount = 0;
    const oneXTwoStats = createMarketAccumulator(Market.ONE_X_TWO);

    for (const fixture of fixtures) {
      if (fixture.homeScore === null || fixture.awayScore === null) {
        skippedCount++;
        continue;
      }

      const homeStats = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.homeTeamId) ?? [],
        fixture,
        BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS,
      );
      const awayStats = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.awayTeamId) ?? [],
        fixture,
        BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS,
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
      evTotal = evTotal.plus(simulation.ev);
      evCount++;

      oneXTwoStats.betsPlaced++;
      oneXTwoStats.stake = oneXTwoStats.stake.plus(1);
      oneXTwoStats.profit = oneXTwoStats.profit.plus(simulation.profit);
      oneXTwoStats.evTotal = oneXTwoStats.evTotal.plus(simulation.ev);
      if (simulation.result === 'WIN') oneXTwoStats.wins++;
      if (simulation.result === 'LOSS') oneXTwoStats.losses++;

      oneXTwoStats.equity = oneXTwoStats.equity.plus(simulation.profit);
      if (oneXTwoStats.equity.greaterThan(oneXTwoStats.equityPeak)) {
        oneXTwoStats.equityPeak = oneXTwoStats.equity;
      }
      const drawdown = oneXTwoStats.equityPeak.minus(oneXTwoStats.equity);
      if (drawdown.greaterThan(oneXTwoStats.maxDrawdown)) {
        oneXTwoStats.maxDrawdown = drawdown;
      }
    }

    const roiSimulated = roiStake.greaterThan(0)
      ? roiProfit.div(roiStake)
      : new Decimal(0);
    const averageEvSimulated =
      evCount > 0 ? evTotal.div(evCount) : new Decimal(0);
    const marketPerformance: BacktestMarketPerformance[] = [
      buildMarketPerformance(oneXTwoStats),
    ];

    const report: BacktestReport = {
      seasonId,
      fixtureCount: fixtures.length,
      analyzedCount,
      skippedCount,
      brierScore: new Decimal(brierScoreOneXTwo(oneXTwoPredictions)),
      calibrationError: new Decimal(calibrationError(calibrationPoints)),
      roiSimulated,
      maxDrawdownSimulated: oneXTwoStats.maxDrawdown,
      averageEvSimulated,
      marketPerformance,
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
        maxDrawdownSimulated: report.maxDrawdownSimulated.toNumber(),
        averageEvSimulated: report.averageEvSimulated.toNumber(),
      },
      'Backtest complete',
    );

    if (
      report.brierScore.greaterThan(RISK_CONSTANTS.BRIER_SCORE_ALERT_THRESHOLD)
    ) {
      await this.notification.sendBrierScoreAlert(
        seasonId,
        report.brierScore.toNumber(),
      );
    }

    return report;
  }

  async runAllSeasons(): Promise<AllSeasonsBacktestReport> {
    const seasons = await this.prisma.client.season.findMany({
      select: { id: true },
    });

    logger.info(
      { seasonCount: seasons.length },
      'Starting all-seasons backtest',
    );

    const reports: BacktestReport[] = [];
    for (const season of seasons) {
      const report = await this.runBacktest(season.id);
      reports.push(report);
    }

    const totalFixtures = reports.reduce((sum, r) => sum + r.fixtureCount, 0);
    const totalAnalyzed = reports.reduce((sum, r) => sum + r.analyzedCount, 0);

    const averageBrierScore =
      reports.length > 0
        ? reports
            .reduce((sum, r) => sum.plus(r.brierScore), new Decimal(0))
            .div(reports.length)
        : new Decimal(0);

    const averageCalibrationError =
      reports.length > 0
        ? reports
            .reduce((sum, r) => sum.plus(r.calibrationError), new Decimal(0))
            .div(reports.length)
        : new Decimal(0);

    // Weighted aggregate ROI: profit_total / stake_total across all seasons.
    // stake per season = betsPlaced (1 unit per bet), profit_i = roi_i * betsPlaced_i.
    const totalBets = reports.reduce(
      (sum, r) => sum + (r.marketPerformance[0]?.betsPlaced ?? 0),
      0,
    );
    const aggregateRoi =
      totalBets > 0
        ? reports
            .reduce((sum, r) => {
              const bets = r.marketPerformance[0]?.betsPlaced ?? 0;
              return sum.plus(r.roiSimulated.mul(bets));
            }, new Decimal(0))
            .div(totalBets)
        : new Decimal(0);

    logger.info(
      {
        seasonCount: seasons.length,
        totalFixtures,
        totalAnalyzed,
        averageBrierScore: averageBrierScore.toNumber(),
        averageCalibrationError: averageCalibrationError.toNumber(),
        aggregateRoi: aggregateRoi.toNumber(),
      },
      'All-seasons backtest complete',
    );

    return {
      seasons: reports,
      totalFixtures,
      totalAnalyzed,
      averageBrierScore,
      averageCalibrationError,
      aggregateRoi,
      reportGeneratedAt: new Date(),
    };
  }

  async getValidationReport(): Promise<ValidationReport> {
    const allSeasons = await this.runAllSeasons();
    const {
      averageBrierScore,
      averageCalibrationError,
      aggregateRoi,
      totalAnalyzed,
    } = allSeasons;

    const insufficient =
      totalAnalyzed < BACKTEST_CONSTANTS.MIN_FIXTURES_FOR_VALIDATION;

    const brierVerdict: ValidationVerdict = insufficient
      ? 'INSUFFICIENT_DATA'
      : averageBrierScore.lessThanOrEqualTo(
            BACKTEST_CONSTANTS.BRIER_SCORE_PASS_THRESHOLD,
          )
        ? 'PASS'
        : 'FAIL';

    const calibrationVerdict: ValidationVerdict = insufficient
      ? 'INSUFFICIENT_DATA'
      : averageCalibrationError.lessThanOrEqualTo(
            BACKTEST_CONSTANTS.CALIBRATION_ERROR_PASS_THRESHOLD,
          )
        ? 'PASS'
        : 'FAIL';

    const roiVerdict: ValidationVerdict = insufficient
      ? 'INSUFFICIENT_DATA'
      : aggregateRoi.greaterThanOrEqualTo(
            BACKTEST_CONSTANTS.ROI_FLOOR_THRESHOLD,
          )
        ? 'PASS'
        : 'FAIL';

    const verdicts: ValidationVerdict[] = [
      brierVerdict,
      calibrationVerdict,
      roiVerdict,
    ];
    const overallVerdict: ValidationVerdict = verdicts.includes(
      'INSUFFICIENT_DATA',
    )
      ? 'INSUFFICIENT_DATA'
      : verdicts.includes('FAIL')
        ? 'FAIL'
        : 'PASS';

    const brierScore: MetricResult = {
      value: averageBrierScore,
      threshold: BACKTEST_CONSTANTS.BRIER_SCORE_PASS_THRESHOLD,
      verdict: brierVerdict,
    };
    const calibrationError: MetricResult = {
      value: averageCalibrationError,
      threshold: BACKTEST_CONSTANTS.CALIBRATION_ERROR_PASS_THRESHOLD,
      verdict: calibrationVerdict,
    };
    const roi: MetricResult = {
      value: aggregateRoi,
      threshold: BACKTEST_CONSTANTS.ROI_FLOOR_THRESHOLD,
      verdict: roiVerdict,
    };

    logger.info(
      {
        totalAnalyzed,
        brierScore: averageBrierScore.toNumber(),
        brierVerdict,
        calibrationError: averageCalibrationError.toNumber(),
        calibrationVerdict,
        roi: aggregateRoi.toNumber(),
        roiVerdict,
        overallVerdict,
      },
      'Validation report generated',
    );

    return {
      brierScore,
      calibrationError,
      roi,
      totalAnalyzed,
      overallVerdict,
      reportGeneratedAt: new Date(),
    };
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
  minCount = 0,
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

  if (best < 0) return null;
  // Cold-start guard: skip fixtures where a team has insufficient prior data.
  if (minCount > 0 && best + 1 < minCount) return null;
  return stats[best].stats;
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
): { placed: boolean; ev: Decimal; profit: Decimal; result?: 'WIN' | 'LOSS' } {
  const picks: Array<{
    outcome: 'HOME' | 'DRAW' | 'AWAY';
    prob: Decimal;
    odds: Decimal;
    ev: Decimal;
  }> = [
    {
      outcome: 'HOME',
      prob: new Decimal(probabilities.home),
      odds: odds.home,
      ev: calculateEV(probabilities.home, odds.home),
    },
    {
      outcome: 'DRAW',
      prob: new Decimal(probabilities.draw),
      odds: odds.draw,
      ev: calculateEV(probabilities.draw, odds.draw),
    },
    {
      outcome: 'AWAY',
      prob: new Decimal(probabilities.away),
      odds: odds.away,
      ev: calculateEV(probabilities.away, odds.away),
    },
  ];

  const bestPick = picks.reduce((best, current) =>
    current.ev.greaterThan(best.ev) ? current : best,
  );

  if (
    bestPick.ev.lessThan(EV_THRESHOLD) ||
    bestPick.odds.lessThanOrEqualTo(1) ||
    !bestPick.prob.isFinite() ||
    !bestPick.odds.isFinite()
  ) {
    return { placed: false, ev: bestPick.ev, profit: new Decimal(0) };
  }

  if (bestPick.outcome === actual) {
    return {
      placed: true,
      ev: bestPick.ev,
      profit: bestPick.odds.minus(1),
      result: 'WIN',
    };
  }

  return {
    placed: true,
    ev: bestPick.ev,
    profit: new Decimal(-1),
    result: 'LOSS',
  };
}

function createMarketAccumulator(market: Market): MarketAccumulator {
  return {
    market,
    betsPlaced: 0,
    wins: 0,
    losses: 0,
    voids: 0,
    stake: new Decimal(0),
    profit: new Decimal(0),
    evTotal: new Decimal(0),
    equity: new Decimal(0),
    equityPeak: new Decimal(0),
    maxDrawdown: new Decimal(0),
  };
}

function buildMarketPerformance(
  stats: MarketAccumulator,
): BacktestMarketPerformance {
  const roi = stats.stake.greaterThan(0)
    ? stats.profit.div(stats.stake)
    : new Decimal(0);
  const averageEv =
    stats.betsPlaced > 0 ? stats.evTotal.div(stats.betsPlaced) : new Decimal(0);

  return {
    market: stats.market,
    betsPlaced: stats.betsPlaced,
    wins: stats.wins,
    losses: stats.losses,
    voids: stats.voids,
    stake: stats.stake,
    profit: stats.profit,
    roi,
    averageEv,
    maxDrawdown: stats.maxDrawdown,
  };
}
