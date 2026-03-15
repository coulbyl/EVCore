import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type {
  FullOddsSnapshot,
  TeamStatsInput,
  ViablePick,
} from '@modules/betting-engine/betting-engine.types';
import { MODEL_SCORE_THRESHOLD } from '@modules/betting-engine/ev.constants';
import {
  buildPoissonDistributions,
  resolveComboPickBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
} from '@modules/betting-engine/betting-engine.utils';
import {
  brierScoreOneXTwo,
  calibrationError,
  getOneXTwoOutcome,
  type AllSeasonsBacktestReport,
  type BacktestOddsBucketPerformance,
  type BacktestMarketPerformance,
  type BacktestPickPerformance,
  type BacktestReport,
  type CalibrationPoint,
  type CompetitionBacktestSummary,
  type MetricResult,
  type OneXTwoPrediction,
  type ValidationReport,
  type ValidationVerdict,
} from './backtest.report';
import { BACKTEST_CONSTANTS } from './backtest.constants';

const logger = createLogger('backtest-service');

type FixtureForBacktest = {
  id: string;
  seasonId: string;
  scheduledAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  homeHtScore: number | null;
  awayHtScore: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

type TeamStatsIndexEntry = {
  afterFixtureId: string;
  scheduledAt: Date;
  stats: TeamStatsInput;
};

type MarketAccumulator = {
  market: Market;
  betsPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  stake: Decimal;
  profit: Decimal;
  oddsTotal: Decimal;
  evTotal: Decimal;
  equity: Decimal;
  equityPeak: Decimal;
  maxDrawdown: Decimal;
  picks: Map<string, PickAccumulator>;
  buckets: Map<string, BucketAccumulator>;
};

type PickAccumulator = {
  pick: string;
  betsPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  stake: Decimal;
  profit: Decimal;
  oddsTotal: Decimal;
  evTotal: Decimal;
};

type BucketAccumulator = {
  bucket: string;
  betsPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  stake: Decimal;
  profit: Decimal;
  oddsTotal: Decimal;
  evTotal: Decimal;
};

@Injectable()
export class BacktestService {
  private latestAllSeasonsReport: AllSeasonsBacktestReport | null = null;
  private latestValidationReport: ValidationReport | null = null;

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
        xgUnavailable: false,
      },
      select: {
        id: true,
        seasonId: true,
        scheduledAt: true,
        homeTeamId: true,
        awayTeamId: true,
        homeHtScore: true,
        awayHtScore: true,
        homeScore: true,
        awayScore: true,
      },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    });

    const teamStatsByTeam = await this.loadTeamStatsIndexForSeason(seasonId);
    const oddsByFixture =
      await this.loadLatestOddsSnapshotsForFixtures(fixtures);

    const oneXTwoPredictions: OneXTwoPrediction[] = [];
    const calibrationPoints: CalibrationPoint[] = [];
    let analyzedCount = 0;
    let skippedCount = 0;
    let roiProfit = new Decimal(0);
    let roiStake = new Decimal(0);
    let evTotal = new Decimal(0);
    let evCount = 0;
    const marketStats = new Map<Market, MarketAccumulator>();

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

      if (computed.deterministicScore.lessThan(MODEL_SCORE_THRESHOLD)) {
        continue;
      }

      const { distHome, distAway } = buildPoissonDistributions(
        computed.lambda.home,
        computed.lambda.away,
      );
      const lambdaFloorHit =
        computed.lambda.home <= Number.EPSILON + 0.05 ||
        computed.lambda.away <= Number.EPSILON + 0.05;

      const pick = this.bettingEngine.selectBestViablePickForBacktest({
        probabilities: computed.probabilities,
        odds,
        deterministicScore: computed.deterministicScore,
        distHome,
        distAway,
        lambdaFloorHit,
      });

      if (!pick) {
        continue;
      }

      const simulation = simulatePick(fixture, pick);
      if (!simulation.placed) {
        continue;
      }

      roiProfit = roiProfit.plus(simulation.profit);
      if (!simulation.voided) {
        roiStake = roiStake.plus(1);
      }
      evTotal = evTotal.plus(simulation.ev);
      evCount++;

      const stats = getOrCreateMarketAccumulator(marketStats, pick.market);
      stats.betsPlaced++;
      if (!simulation.voided) {
        stats.stake = stats.stake.plus(1);
      }
      stats.profit = stats.profit.plus(simulation.profit);
      stats.oddsTotal = stats.oddsTotal.plus(pick.odds);
      stats.evTotal = stats.evTotal.plus(simulation.ev);
      if (simulation.result === 'WIN') stats.wins++;
      if (simulation.result === 'LOSS') stats.losses++;
      if (simulation.result === 'VOID') stats.voids++;

      stats.equity = stats.equity.plus(simulation.profit);
      if (stats.equity.greaterThan(stats.equityPeak)) {
        stats.equityPeak = stats.equity;
      }
      const drawdown = stats.equityPeak.minus(stats.equity);
      if (drawdown.greaterThan(stats.maxDrawdown)) {
        stats.maxDrawdown = drawdown;
      }

      const pickStats = getOrCreatePickAccumulator(stats.picks, pick.pick);
      pickStats.betsPlaced++;
      if (!simulation.voided) {
        pickStats.stake = pickStats.stake.plus(1);
      }
      pickStats.profit = pickStats.profit.plus(simulation.profit);
      pickStats.oddsTotal = pickStats.oddsTotal.plus(pick.odds);
      pickStats.evTotal = pickStats.evTotal.plus(simulation.ev);
      if (simulation.result === 'WIN') pickStats.wins++;
      if (simulation.result === 'LOSS') pickStats.losses++;
      if (simulation.result === 'VOID') pickStats.voids++;

      const oddsBucket = getOddsBucketLabel(pick.odds);
      const bucketStats = getOrCreateBucketAccumulator(
        stats.buckets,
        oddsBucket,
      );
      bucketStats.betsPlaced++;
      if (!simulation.voided) {
        bucketStats.stake = bucketStats.stake.plus(1);
      }
      bucketStats.profit = bucketStats.profit.plus(simulation.profit);
      bucketStats.oddsTotal = bucketStats.oddsTotal.plus(pick.odds);
      bucketStats.evTotal = bucketStats.evTotal.plus(simulation.ev);
      if (simulation.result === 'WIN') bucketStats.wins++;
      if (simulation.result === 'LOSS') bucketStats.losses++;
      if (simulation.result === 'VOID') bucketStats.voids++;
    }

    const roiSimulated = roiStake.greaterThan(0)
      ? roiProfit.div(roiStake)
      : new Decimal(0);
    const averageEvSimulated =
      evCount > 0 ? evTotal.div(evCount) : new Decimal(0);
    const marketPerformance: BacktestMarketPerformance[] = Array.from(
      marketStats.values(),
      (stats) => buildMarketPerformance(stats),
    ).sort((a, b) => a.market.localeCompare(b.market));

    const report: BacktestReport = {
      seasonId,
      fixtureCount: fixtures.length,
      analyzedCount,
      skippedCount,
      brierScore: new Decimal(brierScoreOneXTwo(oneXTwoPredictions)),
      calibrationError: new Decimal(calibrationError(calibrationPoints)),
      roiSimulated,
      maxDrawdownSimulated: marketPerformance.reduce(
        (max, market) =>
          market.maxDrawdown.greaterThan(max) ? market.maxDrawdown : max,
        new Decimal(0),
      ),
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

    return report;
  }

  async runAllSeasons(): Promise<AllSeasonsBacktestReport> {
    const seasons = await this.prisma.client.season.findMany({
      where: { competition: { includeInBacktest: true } },
      select: {
        id: true,
        competition: { select: { id: true, code: true, name: true } },
      },
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

    // Total bets placed across all seasons (informational — no filter).
    const totalBets = reports.reduce((sum, r) => sum + getTotalBets(r), 0);

    // Weighted aggregate ROI: profit_total / stake_total across qualifying seasons.
    // Seasons with fewer than MIN_BETS_FOR_ROI bets are excluded from ROI/profit/EV
    // computation — a single loss in a 1-bet season produces ROI = -100%, which is
    // noise not signal. totalBets above is not affected by this filter.
    const roiReports = reports.filter(
      (r) => getTotalBets(r) >= BACKTEST_CONSTANTS.MIN_BETS_FOR_ROI,
    );
    // aggregateProfit = real profit across all bets, no filter.
    const aggregateProfit = reports.reduce(
      (sum, r) => sum.plus(sumProfit(r.marketPerformance)),
      new Decimal(0),
    );
    // aggregateRoi = weighted ROI only on qualifying seasons (anti-noise filter).
    const roiBets = roiReports.reduce((sum, r) => sum + getTotalBets(r), 0);
    const aggregateRoi =
      roiBets > 0
        ? roiReports
            .reduce((sum, r) => {
              const bets = getTotalBets(r);
              return sum.plus(r.roiSimulated.mul(bets));
            }, new Decimal(0))
            .div(roiBets)
        : totalBets > 0
          ? aggregateProfit.div(totalBets)
          : new Decimal(0);
    const averageEvSimulated =
      totalBets > 0
        ? reports
            .reduce(
              (sum, r) => sum.plus(r.averageEvSimulated.mul(getTotalBets(r))),
              new Decimal(0),
            )
            .div(totalBets)
        : new Decimal(0);

    const byCompetition = buildCompetitionBreakdown(seasons, reports);

    logger.info(
      {
        seasonCount: seasons.length,
        totalFixtures,
        totalAnalyzed,
        totalBets,
        averageBrierScore: averageBrierScore.toNumber(),
        averageCalibrationError: averageCalibrationError.toNumber(),
        aggregateRoi: aggregateRoi.toNumber(),
        aggregateProfit: aggregateProfit.toNumber(),
        averageEvSimulated: averageEvSimulated.toNumber(),
        competitionCount: byCompetition.length,
      },
      'All-seasons backtest complete',
    );

    const report: AllSeasonsBacktestReport = {
      seasons: reports,
      totalFixtures,
      totalAnalyzed,
      totalBets,
      averageBrierScore,
      averageCalibrationError,
      aggregateRoi,
      aggregateProfit,
      averageEvSimulated,
      byCompetition,
      reportGeneratedAt: new Date(),
    };

    this.latestAllSeasonsReport = report;
    this.latestValidationReport = null;

    return report;
  }

  async getValidationReport(): Promise<ValidationReport> {
    if (this.latestValidationReport) {
      return this.latestValidationReport;
    }

    const allSeasons =
      this.latestAllSeasonsReport ?? (await this.runAllSeasons());
    const {
      averageBrierScore,
      averageCalibrationError,
      aggregateRoi,
      totalAnalyzed,
      totalBets,
      aggregateProfit,
      averageEvSimulated,
      byCompetition,
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
        totalBets,
        brierScore: averageBrierScore.toNumber(),
        brierVerdict,
        calibrationError: averageCalibrationError.toNumber(),
        calibrationVerdict,
        roi: aggregateRoi.toNumber(),
        aggregateProfit: aggregateProfit.toNumber(),
        averageEvSimulated: averageEvSimulated.toNumber(),
        roiVerdict,
        overallVerdict,
      },
      'Validation report generated',
    );

    const report: ValidationReport = {
      brierScore,
      calibrationError,
      roi,
      totalAnalyzed,
      totalBets,
      aggregateProfit,
      averageEvSimulated,
      overallVerdict,
      byCompetition,
      reportGeneratedAt: new Date(),
    };

    this.latestValidationReport = report;

    return report;
  }

  async refreshValidationReport(): Promise<ValidationReport> {
    await this.runAllSeasons();
    return this.getValidationReport();
  }

  getLatestValidationReport(): ValidationReport | null {
    return this.latestValidationReport;
  }

  getLatestAllSeasonsReport(): AllSeasonsBacktestReport | null {
    return this.latestAllSeasonsReport;
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

  private async loadLatestOddsSnapshotsForFixtures(
    fixtures: FixtureForBacktest[],
  ): Promise<Map<string, FullOddsSnapshot>> {
    if (fixtures.length === 0) {
      return new Map<string, FullOddsSnapshot>();
    }

    const fixtureIds = fixtures.map((fixture) => fixture.id);

    const rows = await this.prisma.client.oddsSnapshot.findMany({
      where: {
        fixtureId: { in: fixtureIds },
        market: {
          in: [
            Market.ONE_X_TWO,
            Market.OVER_UNDER,
            Market.BTTS,
            Market.HALF_TIME_FULL_TIME,
          ],
        },
      },
      select: {
        fixtureId: true,
        bookmaker: true,
        market: true,
        pick: true,
        snapshotAt: true,
        homeOdds: true,
        drawOdds: true,
        awayOdds: true,
        odds: true,
      },
      orderBy: [
        { fixtureId: 'asc' },
        { snapshotAt: 'desc' },
        { bookmaker: 'asc' },
      ],
    });

    const rowsByFixture = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = rowsByFixture.get(row.fixtureId) ?? [];
      list.push(row);
      rowsByFixture.set(row.fixtureId, list);
    }

    const latest = new Map<string, FullOddsSnapshot>();
    for (const fixture of fixtures) {
      const fixtureRows = rowsByFixture.get(fixture.id) ?? [];

      const oneXTwoRows = fixtureRows.filter(
        (row) =>
          row.market === Market.ONE_X_TWO &&
          row.snapshotAt <= fixture.scheduledAt &&
          row.homeOdds !== null &&
          row.drawOdds !== null &&
          row.awayOdds !== null,
      );

      if (oneXTwoRows.length === 0) {
        continue;
      }

      const latestSnapshotAt = oneXTwoRows[0].snapshotAt.getTime();
      const bestOneXTwo = oneXTwoRows
        .filter((row) => row.snapshotAt.getTime() === latestSnapshotAt)
        .sort((a, b) => bookmakerRank(a.bookmaker) - bookmakerRank(b.bookmaker))
        .at(0);

      if (
        !bestOneXTwo ||
        bestOneXTwo.homeOdds === null ||
        bestOneXTwo.drawOdds === null ||
        bestOneXTwo.awayOdds === null
      ) {
        continue;
      }

      const findLatestPickOdds = (
        market: Market,
        pick: string,
      ): Decimal | null => {
        const row = fixtureRows.find(
          (entry) =>
            entry.bookmaker === bestOneXTwo.bookmaker &&
            entry.market === market &&
            entry.pick === pick &&
            entry.snapshotAt <= fixture.scheduledAt &&
            entry.odds !== null,
        );
        return row?.odds ?? null;
      };

      const htftOdds: FullOddsSnapshot['htftOdds'] = {};
      for (const row of fixtureRows) {
        if (
          row.bookmaker !== bestOneXTwo.bookmaker ||
          row.market !== Market.HALF_TIME_FULL_TIME ||
          row.pick === null ||
          row.odds === null ||
          row.snapshotAt > fixture.scheduledAt ||
          row.pick in htftOdds
        ) {
          continue;
        }
        htftOdds[row.pick] = row.odds;
      }

      latest.set(fixture.id, {
        bookmaker: bestOneXTwo.bookmaker,
        snapshotAt: bestOneXTwo.snapshotAt,
        homeOdds: bestOneXTwo.homeOdds,
        drawOdds: bestOneXTwo.drawOdds,
        awayOdds: bestOneXTwo.awayOdds,
        overOdds: findLatestPickOdds(Market.OVER_UNDER, 'OVER'),
        underOdds: findLatestPickOdds(Market.OVER_UNDER, 'UNDER'),
        bttsYesOdds: findLatestPickOdds(Market.BTTS, 'YES'),
        bttsNoOdds: findLatestPickOdds(Market.BTTS, 'NO'),
        htftOdds,
      });
    }

    return latest;
  }
}

type SeasonWithCompetition = {
  id: string;
  competition: { id: string; code: string; name: string };
};

function buildCompetitionBreakdown(
  seasons: SeasonWithCompetition[],
  reports: BacktestReport[],
): CompetitionBacktestSummary[] {
  type Entry = {
    competition: SeasonWithCompetition['competition'];
    reports: BacktestReport[];
  };
  const byId = new Map<string, Entry>();

  for (let i = 0; i < seasons.length; i++) {
    const season = seasons[i];
    const report = reports[i];
    if (!season || !report) continue;
    const entry = byId.get(season.competition.id) ?? {
      competition: season.competition,
      reports: [],
    };
    entry.reports.push(report);
    byId.set(season.competition.id, entry);
  }

  return Array.from(byId.values()).map(
    ({ competition, reports: compReports }) => {
      const analyzed = compReports.reduce((s, r) => s + r.analyzedCount, 0);
      const avgBrier =
        compReports.length > 0
          ? compReports
              .reduce((s, r) => s.plus(r.brierScore), new Decimal(0))
              .div(compReports.length)
          : new Decimal(0);
      const avgCal =
        compReports.length > 0
          ? compReports
              .reduce((s, r) => s.plus(r.calibrationError), new Decimal(0))
              .div(compReports.length)
          : new Decimal(0);
      const totalBets = compReports.reduce((s, r) => s + getTotalBets(r), 0);
      const roiCompReports = compReports.filter(
        (r) => getTotalBets(r) >= BACKTEST_CONSTANTS.MIN_BETS_FOR_ROI,
      );
      const aggregateProfit = compReports.reduce(
        (sum, r) => sum.plus(sumProfit(r.marketPerformance)),
        new Decimal(0),
      );
      const roiBets = roiCompReports.reduce((s, r) => s + getTotalBets(r), 0);
      const roi =
        roiBets > 0
          ? roiCompReports
              .reduce((s, r) => {
                const bets = getTotalBets(r);
                return s.plus(r.roiSimulated.mul(bets));
              }, new Decimal(0))
              .div(roiBets)
          : totalBets > 0
            ? aggregateProfit.div(totalBets)
            : new Decimal(0);
      const averageEvSimulated =
        totalBets > 0
          ? compReports
              .reduce(
                (sum, r) => sum.plus(r.averageEvSimulated.mul(getTotalBets(r))),
                new Decimal(0),
              )
              .div(totalBets)
          : new Decimal(0);
      const marketPerformance = aggregateMarketPerformance(
        compReports.flatMap((report) => report.marketPerformance),
      );
      const maxDrawdownSimulated = marketPerformance.reduce(
        (max, market) =>
          market.maxDrawdown.greaterThan(max) ? market.maxDrawdown : max,
        new Decimal(0),
      );

      return {
        competitionId: competition.id,
        competitionCode: competition.code,
        competitionName: competition.name,
        seasonCount: compReports.length,
        totalAnalyzed: analyzed,
        totalBets,
        averageBrierScore: avgBrier,
        averageCalibrationError: avgCal,
        aggregateRoi: roi,
        aggregateProfit,
        averageEvSimulated,
        maxDrawdownSimulated,
        marketPerformance,
      };
    },
  );
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

function createMarketAccumulator(market: Market): MarketAccumulator {
  return {
    market,
    betsPlaced: 0,
    wins: 0,
    losses: 0,
    voids: 0,
    stake: new Decimal(0),
    profit: new Decimal(0),
    oddsTotal: new Decimal(0),
    evTotal: new Decimal(0),
    equity: new Decimal(0),
    equityPeak: new Decimal(0),
    maxDrawdown: new Decimal(0),
    picks: new Map<string, PickAccumulator>(),
    buckets: new Map<string, BucketAccumulator>(),
  };
}

function getOrCreateMarketAccumulator(
  byMarket: Map<Market, MarketAccumulator>,
  market: Market,
): MarketAccumulator {
  const current = byMarket.get(market);
  if (current) {
    return current;
  }

  const created = createMarketAccumulator(market);
  byMarket.set(market, created);
  return created;
}

function createPickAccumulator(pick: string): PickAccumulator {
  return {
    pick,
    betsPlaced: 0,
    wins: 0,
    losses: 0,
    voids: 0,
    stake: new Decimal(0),
    profit: new Decimal(0),
    oddsTotal: new Decimal(0),
    evTotal: new Decimal(0),
  };
}

function getOrCreatePickAccumulator(
  byPick: Map<string, PickAccumulator>,
  pick: string,
): PickAccumulator {
  const current = byPick.get(pick);
  if (current) {
    return current;
  }

  const created = createPickAccumulator(pick);
  byPick.set(pick, created);
  return created;
}

function createBucketAccumulator(bucket: string): BucketAccumulator {
  return {
    bucket,
    betsPlaced: 0,
    wins: 0,
    losses: 0,
    voids: 0,
    stake: new Decimal(0),
    profit: new Decimal(0),
    oddsTotal: new Decimal(0),
    evTotal: new Decimal(0),
  };
}

function getOrCreateBucketAccumulator(
  byBucket: Map<string, BucketAccumulator>,
  bucket: string,
): BucketAccumulator {
  const current = byBucket.get(bucket);
  if (current) {
    return current;
  }

  const created = createBucketAccumulator(bucket);
  byBucket.set(bucket, created);
  return created;
}

function aggregateMarketPerformance(
  entries: BacktestMarketPerformance[],
): BacktestMarketPerformance[] {
  const byMarket = new Map<Market, MarketAccumulator>();

  for (const entry of entries) {
    const stats = getOrCreateMarketAccumulator(byMarket, entry.market);
    stats.betsPlaced += entry.betsPlaced;
    stats.wins += entry.wins;
    stats.losses += entry.losses;
    stats.voids += entry.voids;
    stats.stake = stats.stake.plus(entry.stake);
    stats.profit = stats.profit.plus(entry.profit);
    stats.oddsTotal = stats.oddsTotal.plus(
      entry.averageOdds.mul(entry.betsPlaced),
    );
    stats.evTotal = stats.evTotal.plus(entry.averageEv.mul(entry.betsPlaced));
    stats.maxDrawdown = Decimal.max(stats.maxDrawdown, entry.maxDrawdown);

    for (const pick of entry.pickBreakdown) {
      const pickStats = getOrCreatePickAccumulator(stats.picks, pick.pick);
      pickStats.betsPlaced += pick.betsPlaced;
      pickStats.wins += pick.wins;
      pickStats.losses += pick.losses;
      pickStats.voids += pick.voids;
      pickStats.stake = pickStats.stake.plus(pick.stake);
      pickStats.profit = pickStats.profit.plus(pick.profit);
      pickStats.oddsTotal = pickStats.oddsTotal.plus(
        pick.averageOdds.mul(pick.betsPlaced),
      );
      pickStats.evTotal = pickStats.evTotal.plus(
        pick.averageEv.mul(pick.betsPlaced),
      );
    }

    for (const bucket of entry.oddsBuckets) {
      const bucketStats = getOrCreateBucketAccumulator(
        stats.buckets,
        bucket.bucket,
      );
      bucketStats.betsPlaced += bucket.betsPlaced;
      bucketStats.wins += bucket.wins;
      bucketStats.losses += bucket.losses;
      bucketStats.voids += bucket.voids;
      bucketStats.stake = bucketStats.stake.plus(bucket.stake);
      bucketStats.profit = bucketStats.profit.plus(bucket.profit);
      bucketStats.oddsTotal = bucketStats.oddsTotal.plus(
        bucket.averageOdds.mul(bucket.betsPlaced),
      );
      bucketStats.evTotal = bucketStats.evTotal.plus(
        bucket.averageEv.mul(bucket.betsPlaced),
      );
    }
  }

  return Array.from(byMarket.values(), (stats) =>
    buildMarketPerformance(stats),
  ).sort((a, b) => a.market.localeCompare(b.market));
}

function bookmakerRank(bookmaker: string): number {
  if (bookmaker === 'Pinnacle') return 0;
  if (bookmaker === 'Bet365') return 1;
  if (bookmaker === 'MarketAvg') return 2;
  return 3;
}

function getOddsBucketLabel(odds: Decimal): string {
  if (odds.lessThan(2)) return '<2.0';
  if (odds.lessThan(3)) return '2.0-2.99';
  if (odds.lessThan(5)) return '3.0-4.99';
  return '>=5.0';
}

function compareOddsBucketLabel(a: string, b: string): number {
  return oddsBucketRank(a) - oddsBucketRank(b);
}

function oddsBucketRank(bucket: string): number {
  if (bucket === '<2.0') return 0;
  if (bucket === '2.0-2.99') return 1;
  if (bucket === '3.0-4.99') return 2;
  if (bucket === '>=5.0') return 3;
  return 99;
}

function getTotalBets(report: BacktestReport): number {
  return report.marketPerformance.reduce(
    (sum, market) => sum + market.betsPlaced,
    0,
  );
}

function sumProfit(markets: BacktestMarketPerformance[]): Decimal {
  return markets.reduce(
    (sum, market) => sum.plus(market.profit),
    new Decimal(0),
  );
}

function simulatePick(
  fixture: FixtureForBacktest,
  pick: ViablePick,
): {
  placed: boolean;
  voided: boolean;
  ev: Decimal;
  profit: Decimal;
  result: 'WIN' | 'LOSS' | 'VOID';
} {
  const status =
    pick.comboMarket && pick.comboPick
      ? resolveComboPickBetStatus(
          {
            market1: pick.market,
            pick1: pick.pick,
            market2: pick.comboMarket,
            pick2: pick.comboPick,
          },
          fixture.homeScore,
          fixture.awayScore,
        )
      : pick.market === Market.HALF_TIME_FULL_TIME
        ? resolveHalfTimeFullTimeBetStatus({
            pick: pick.pick,
            homeHtScore: fixture.homeHtScore,
            awayHtScore: fixture.awayHtScore,
            homeScore: fixture.homeScore,
            awayScore: fixture.awayScore,
          })
        : resolvePickBetStatus(pick.pick, fixture.homeScore, fixture.awayScore);

  if (status === BetStatus.VOID) {
    return {
      placed: true,
      voided: true,
      ev: pick.ev,
      profit: new Decimal(0),
      result: 'VOID',
    };
  }

  if (status === BetStatus.WON) {
    return {
      placed: true,
      voided: false,
      ev: pick.ev,
      profit: pick.odds.minus(1),
      result: 'WIN',
    };
  }

  return {
    placed: true,
    voided: false,
    ev: pick.ev,
    profit: new Decimal(-1),
    result: 'LOSS',
  };
}

function buildMarketPerformance(
  stats: MarketAccumulator,
): BacktestMarketPerformance {
  const roi = stats.stake.greaterThan(0)
    ? stats.profit.div(stats.stake)
    : new Decimal(0);
  const averageOdds =
    stats.betsPlaced > 0
      ? stats.oddsTotal.div(stats.betsPlaced)
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
    averageOdds,
    averageEv,
    maxDrawdown: stats.maxDrawdown,
    pickBreakdown: Array.from(stats.picks.values(), (pick) =>
      buildPickPerformance(pick),
    ).sort((a, b) => a.pick.localeCompare(b.pick)),
    oddsBuckets: Array.from(stats.buckets.values(), (bucket) =>
      buildOddsBucketPerformance(bucket),
    ).sort((a, b) => compareOddsBucketLabel(a.bucket, b.bucket)),
  };
}

function buildPickPerformance(stats: PickAccumulator): BacktestPickPerformance {
  return {
    pick: stats.pick,
    betsPlaced: stats.betsPlaced,
    wins: stats.wins,
    losses: stats.losses,
    voids: stats.voids,
    stake: stats.stake,
    profit: stats.profit,
    roi: stats.stake.greaterThan(0)
      ? stats.profit.div(stats.stake)
      : new Decimal(0),
    averageOdds:
      stats.betsPlaced > 0
        ? stats.oddsTotal.div(stats.betsPlaced)
        : new Decimal(0),
    averageEv:
      stats.betsPlaced > 0
        ? stats.evTotal.div(stats.betsPlaced)
        : new Decimal(0),
  };
}

function buildOddsBucketPerformance(
  stats: BucketAccumulator,
): BacktestOddsBucketPerformance {
  return {
    bucket: stats.bucket,
    betsPlaced: stats.betsPlaced,
    wins: stats.wins,
    losses: stats.losses,
    voids: stats.voids,
    stake: stats.stake,
    profit: stats.profit,
    roi: stats.stake.greaterThan(0)
      ? stats.profit.div(stats.stake)
      : new Decimal(0),
    averageOdds:
      stats.betsPlaced > 0
        ? stats.oddsTotal.div(stats.betsPlaced)
        : new Decimal(0),
    averageEv:
      stats.betsPlaced > 0
        ? stats.evTotal.div(stats.betsPlaced)
        : new Decimal(0),
  };
}
