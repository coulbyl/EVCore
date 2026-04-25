import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { BetStatus, FixtureStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  TeamStatsInput,
  ViablePick,
} from '@modules/betting-engine/betting-engine.types';
import {
  buildPoissonDistributions,
  resolveComboPickBetStatus,
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
} from '@modules/betting-engine/betting-engine.utils';
import {
  brierScoreOneXTwo,
  calibrationError,
  getOneXTwoOutcome,
  type BacktestOddsBucketPerformance,
  type BacktestMarketPerformance,
  type PredictionBacktestResult,
  type PredictionBacktestSummary,
  type BacktestPickPerformance,
  type BacktestReport,
  type CalibrationPoint,
  type CompetitionBacktestReport,
  type MetricResult,
  type OneXTwoPrediction,
  type PredictionCalibrationRecommendation,
  type PredictionThresholdBacktest,
  type ValidationMarketSummary,
  type ValidationVerdict,
} from './backtest.report';
import {
  BACKTEST_CONSTANTS,
  getBrierScorePassThreshold,
} from './backtest.constants';
import {
  getModelScoreThreshold,
  isEuropeanCompetition,
  EUROPEAN_CROSS_COMP_FORM_WEIGHT,
  EUROPEAN_CROSS_COMP_XG_WEIGHT,
} from '@modules/betting-engine/ev.constants';
import { blendTeamStats } from '@modules/betting-engine/betting-engine.service';
import { getPredictionConfig } from '@modules/prediction/prediction.constants';

const logger = createLogger('backtest-service');
const BACKTEST_ANALYSIS_LOG_FILE = 'backtest-analysis.latest.ndjson';

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

export type SafeValueSeasonResult = {
  seasonId: string;
  competitionCode: string;
  competitionName: string;
  picksPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  profit: Decimal;
  roi: number;
  winRate: number;
  avgProbability: number;
  avgOdds: number;
  avgEv: number;
  daysWithPicks: number;
};

export type SafeValueCompetitionResult = {
  competitionCode: string;
  competitionName: string;
  picksPlaced: number;
  wins: number;
  losses: number;
  voids: number;
  profit: Decimal;
  roi: number;
  winRate: number;
  avgProbability: number;
  avgOdds: number;
  avgEv: number;
  daysWithPicks: number;
  marketPerformance: BacktestMarketPerformance[];
};

export type SafeValueBacktestReport = {
  seasons: SafeValueSeasonResult[];
  competitions: SafeValueCompetitionResult[];
  aggregate: {
    picksPlaced: number;
    wins: number;
    losses: number;
    voids: number;
    profit: Decimal;
    winRate: number;
    roi: number;
    avgProbability: number;
    avgOdds: number;
    avgEv: number;
    daysWithPicks: number;
    marketPerformance: BacktestMarketPerformance[];
  };
  generatedAt: Date;
};

type SafeValuePickEntry = {
  seasonId: string;
  competitionCode: string;
  competitionName: string;
  pick: ViablePick;
  fixture: FixtureForBacktest;
  result: 'WIN' | 'LOSS' | 'VOID';
  profit: Decimal;
};

type BacktestAnalysisReason =
  | 'MISSING_TEAM_STATS'
  | 'MISSING_ODDS'
  | 'BELOW_MODEL_SCORE_THRESHOLD'
  | 'NO_VIABLE_PICK'
  | 'SIMULATION_NOT_PLACED'
  | 'BET_PLACED';

type BacktestAnalysisEntry = {
  seasonId: string;
  competitionCode: string | null;
  fixtureId: string;
  scheduledAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  actualOutcome: 'HOME' | 'DRAW' | 'AWAY' | null;
  reason: BacktestAnalysisReason;
  homeStatsAvailable: boolean;
  awayStatsAvailable: boolean;
  oddsAvailable: boolean;
  deterministicScore: string | null;
  modelScoreThreshold: string | null;
  bookmaker: string | null;
  oddsSnapshotAt: string | null;
  market: Market | null;
  pick: string | null;
  odds: string | null;
  ev: string | null;
  qualityScore: string | null;
  result: 'WIN' | 'LOSS' | 'VOID' | null;
  profit: string | null;
  rejectionReason: string | null;
  rejectionSummary: { reason: string; count: number }[] | null;
  topRejectedCandidates:
    | {
        market: string;
        pick: string;
        comboMarket?: string;
        comboPick?: string;
        odds: string;
        ev: string;
        qualityScore: string;
        rejectionReason: string;
        result: 'WIN' | 'LOSS' | 'VOID';
        profit: string;
      }[]
    | null;
};

type RunBacktestOptions = {
  analysisEntries?: BacktestAnalysisEntry[];
  writeAnalysisLog?: boolean;
};

type PredictionCandidate = {
  probability: number;
  correct: boolean;
};

const PREDICTION_VALIDATION_HIT_RATE = 0.55;
const PREDICTION_VALIDATION_COVERAGE_RATE = 0.1;
const PREDICTION_LOWERING_HIT_RATE = 0.7;
const PREDICTION_THRESHOLD_SCAN = [
  0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95,
];

@Injectable()
export class BacktestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
  ) {}

  async runBacktest(
    seasonId: string,
    competitionCode?: string,
    options: RunBacktestOptions = {},
  ): Promise<BacktestReport> {
    logger.info({ seasonId }, 'Starting backtest');
    const analysisEntries = options.analysisEntries ?? [];
    const writeAnalysisLog = options.writeAnalysisLog ?? true;

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
    const uniqueTeamIds = [
      ...new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId])),
    ];
    const crossCompStatsByTeam = isEuropeanCompetition(competitionCode)
      ? await this.loadCrossCompStatsIndex(seasonId, uniqueTeamIds)
      : new Map<string, TeamStatsIndexEntry[]>();
    const oddsByFixture =
      await this.loadLatestOddsSnapshotsForFixtures(fixtures);

    const oneXTwoPredictions: OneXTwoPrediction[] = [];
    const calibrationPoints: CalibrationPoint[] = [];
    const predictionCandidates: PredictionCandidate[] = [];
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

      const homeStatsRaw = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.homeTeamId) ?? [],
        fixture,
        BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS,
      );
      const awayStatsRaw = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.awayTeamId) ?? [],
        fixture,
        BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS,
      );

      const homeCross = findLatestStatsBeforeFixture(
        crossCompStatsByTeam.get(fixture.homeTeamId) ?? [],
        fixture,
        0,
      );
      const awayCross = findLatestStatsBeforeFixture(
        crossCompStatsByTeam.get(fixture.awayTeamId) ?? [],
        fixture,
        0,
      );

      const homeStats: TeamStatsInput | null = (() => {
        if (!homeStatsRaw) return homeCross ?? null;
        if (homeCross) {
          return blendTeamStats({
            primary: homeStatsRaw,
            secondary: homeCross,
            formWeight: EUROPEAN_CROSS_COMP_FORM_WEIGHT,
            xgWeight: EUROPEAN_CROSS_COMP_XG_WEIGHT,
          });
        }
        return homeStatsRaw;
      })();

      const awayStats: TeamStatsInput | null = (() => {
        if (!awayStatsRaw) return awayCross ?? null;
        if (awayCross) {
          return blendTeamStats({
            primary: awayStatsRaw,
            secondary: awayCross,
            formWeight: EUROPEAN_CROSS_COMP_FORM_WEIGHT,
            xgWeight: EUROPEAN_CROSS_COMP_XG_WEIGHT,
          });
        }
        return awayStatsRaw;
      })();

      if (!homeStats || !awayStats) {
        analysisEntries.push(
          buildAnalysisEntry({
            seasonId,
            competitionCode,
            fixture,
            actualOutcome: null,
            reason: 'MISSING_TEAM_STATS',
            homeStatsAvailable: homeStats !== null,
            awayStatsAvailable: awayStats !== null,
            oddsAvailable: false,
          }),
        );
        skippedCount++;
        continue;
      }

      const computed = this.bettingEngine.computeFromTeamStats(
        homeStats,
        awayStats,
        undefined,
        competitionCode,
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
      predictionCandidates.push(
        buildPredictionCandidate(
          {
            home: computed.probabilities.home,
            draw: computed.probabilities.draw,
            away: computed.probabilities.away,
          },
          actual,
        ),
      );
      analyzedCount++;

      const odds = oddsByFixture.get(fixture.id);
      if (!odds) {
        analysisEntries.push(
          buildAnalysisEntry({
            seasonId,
            competitionCode,
            fixture,
            actualOutcome: actual,
            reason: 'MISSING_ODDS',
            homeStatsAvailable: true,
            awayStatsAvailable: true,
            oddsAvailable: false,
            deterministicScore: computed.deterministicScore,
          }),
        );
        continue;
      }

      const modelScoreThreshold = getModelScoreThreshold(
        competitionCode ?? null,
      );
      if (computed.deterministicScore.lessThan(modelScoreThreshold)) {
        analysisEntries.push(
          buildAnalysisEntry({
            seasonId,
            competitionCode,
            fixture,
            actualOutcome: actual,
            reason: 'BELOW_MODEL_SCORE_THRESHOLD',
            homeStatsAvailable: true,
            awayStatsAvailable: true,
            oddsAvailable: true,
            deterministicScore: computed.deterministicScore,
            modelScoreThreshold,
            bookmaker: odds.bookmaker,
            oddsSnapshotAt: odds.snapshotAt,
          }),
        );
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
        competitionCode,
      });

      if (!pick) {
        const evaluatedPicks = this.bettingEngine.listEvaluatedPicksForBacktest(
          {
            probabilities: computed.probabilities,
            odds,
            deterministicScore: computed.deterministicScore,
            distHome,
            distAway,
            lambdaFloorHit,
            competitionCode: competitionCode ?? null,
          },
        );
        analysisEntries.push(
          buildAnalysisEntry({
            seasonId,
            competitionCode,
            fixture,
            actualOutcome: actual,
            reason: 'NO_VIABLE_PICK',
            homeStatsAvailable: true,
            awayStatsAvailable: true,
            oddsAvailable: true,
            deterministicScore: computed.deterministicScore,
            modelScoreThreshold,
            bookmaker: odds.bookmaker,
            oddsSnapshotAt: odds.snapshotAt,
            rejectionSummary: buildRejectionSummary(evaluatedPicks),
            topRejectedCandidates: buildTopRejectedCandidates(
              fixture,
              evaluatedPicks,
            ),
          }),
        );
        continue;
      }

      const simulation = simulatePick(fixture, pick);
      if (!simulation.placed) {
        analysisEntries.push(
          buildAnalysisEntry({
            seasonId,
            competitionCode,
            fixture,
            actualOutcome: actual,
            reason: 'SIMULATION_NOT_PLACED',
            homeStatsAvailable: true,
            awayStatsAvailable: true,
            oddsAvailable: true,
            deterministicScore: computed.deterministicScore,
            modelScoreThreshold,
            bookmaker: odds.bookmaker,
            oddsSnapshotAt: odds.snapshotAt,
            market: pick.market,
            pick: pick.pick,
            oddsValue: pick.odds,
            ev: simulation.ev,
            qualityScore: pick.qualityScore,
          }),
        );
        continue;
      }

      analysisEntries.push(
        buildAnalysisEntry({
          seasonId,
          competitionCode,
          fixture,
          actualOutcome: actual,
          reason: 'BET_PLACED',
          homeStatsAvailable: true,
          awayStatsAvailable: true,
          oddsAvailable: true,
          deterministicScore: computed.deterministicScore,
          modelScoreThreshold,
          bookmaker: odds.bookmaker,
          oddsSnapshotAt: odds.snapshotAt,
          market: pick.market,
          pick: pick.pick,
          oddsValue: pick.odds,
          ev: simulation.ev,
          qualityScore: pick.qualityScore,
          result: simulation.result,
          profit: simulation.profit,
        }),
      );

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
    const predictionBacktest = buildPredictionBacktestSummary(
      competitionCode ?? null,
      predictionCandidates,
    );

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
      predictionBacktest,
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
        predictionHitRate: report.predictionBacktest.hitRate,
        predictionCoverageRate: report.predictionBacktest.coverageRate,
        predictionVerdict: report.predictionBacktest.verdict,
      },
      'Backtest complete',
    );

    if (writeAnalysisLog) {
      await this.writeBacktestAnalysisLog(analysisEntries, {
        scope: 'season',
        seasonId,
        competitionCode: competitionCode ?? null,
      });
    }

    return report;
  }

  async runCompetitionBacktest(
    competitionCode: string,
    seasonName?: string,
  ): Promise<CompetitionBacktestReport> {
    const competition = await this.prisma.client.competition.findUnique({
      where: { code: competitionCode },
      select: {
        id: true,
        code: true,
        name: true,
        includeInBacktest: true,
      },
    });

    if (!competition) {
      throw new Error(
        `Competition not found for code "${competitionCode}". Check competition.code in DB.`,
      );
    }

    const seasons = await this.prisma.client.season.findMany({
      where: {
        competitionId: competition.id,
        ...(seasonName ? { name: seasonName } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (seasons.length === 0) {
      throw new Error(
        `No season found for competition "${competitionCode}"${seasonName ? ` and season "${seasonName}"` : ''}.`,
      );
    }

    logger.info(
      {
        competitionCode,
        seasonName: seasonName ?? 'ALL',
        seasonCount: seasons.length,
      },
      'Starting competition backtest',
    );

    const reports: BacktestReport[] = [];
    const analysisEntries: BacktestAnalysisEntry[] = [];
    for (const season of seasons) {
      const report = await this.runBacktest(season.id, competition.code, {
        analysisEntries,
        writeAnalysisLog: false,
      });
      reports.push(report);
    }

    const report = buildCompetitionReport({
      competition,
      seasonFilter: seasonName ?? null,
      reports,
    });

    await this.writeBacktestAnalysisLog(analysisEntries, {
      scope: 'competition',
      competitionCode,
      seasonName: seasonName ?? null,
      seasonCount: seasons.length,
    });

    logger.info(
      {
        competitionCode,
        seasonName: seasonName ?? 'ALL',
        totalAnalyzed: report.totalAnalyzed,
        totalBets: report.totalBets,
        brier: report.averageBrierScore.toNumber(),
        brierVerdict: report.brierScore.verdict,
        cal: report.averageCalibrationError.toNumber(),
        calVerdict: report.calibrationError.verdict,
        roi: report.aggregateRoi.toNumber(),
        roiVerdict: report.roi.verdict,
        overallVerdict: report.overallVerdict,
      },
      'Competition backtest complete',
    );

    return report;
  }

  async runAllCompetitions(): Promise<CompetitionBacktestReport[]> {
    const competitions = await this.prisma.client.competition.findMany({
      where: { includeInBacktest: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const reports: CompetitionBacktestReport[] = [];
    for (const { code } of competitions) {
      reports.push(await this.runCompetitionBacktest(code));
    }
    return reports;
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

  /**
   * Load team stats from all seasons EXCEPT `excludeSeasonId` for the given
   * team IDs. Used to supplement European-season stats with domestic form.
   */
  private async loadCrossCompStatsIndex(
    excludeSeasonId: string,
    teamIds: string[],
  ): Promise<Map<string, TeamStatsIndexEntry[]>> {
    if (teamIds.length === 0) return new Map();

    const statsRows = await this.prisma.client.teamStats.findMany({
      where: {
        teamId: { in: teamIds },
        afterFixture: { seasonId: { not: excludeSeasonId } },
      },
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
            Market.OVER_UNDER_HT,
            Market.FIRST_HALF_WINNER,
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
            entry.odds !== null,
        );
        return row?.odds ?? null;
      };

      const htftOdds: FullOddsSnapshot['htftOdds'] = {};
      const ouHtOdds: FullOddsSnapshot['ouHtOdds'] = {};
      const fhwHome = findLatestPickOdds(Market.FIRST_HALF_WINNER, 'HOME');
      const fhwDraw = findLatestPickOdds(Market.FIRST_HALF_WINNER, 'DRAW');
      const fhwAway = findLatestPickOdds(Market.FIRST_HALF_WINNER, 'AWAY');
      const firstHalfWinnerOdds =
        fhwHome && fhwDraw && fhwAway
          ? { home: fhwHome, draw: fhwDraw, away: fhwAway }
          : null;

      for (const row of fixtureRows) {
        if (
          row.bookmaker !== bestOneXTwo.bookmaker ||
          row.pick === null ||
          row.odds === null
        )
          continue;
        if (
          row.market === Market.HALF_TIME_FULL_TIME &&
          !(row.pick in htftOdds)
        ) {
          htftOdds[row.pick] = row.odds;
        }
        if (
          row.market === Market.OVER_UNDER_HT &&
          !(row.pick in ouHtOdds) &&
          (row.pick === 'OVER_0_5' ||
            row.pick === 'UNDER_0_5' ||
            row.pick === 'OVER_1_5' ||
            row.pick === 'UNDER_1_5')
        ) {
          ouHtOdds[row.pick] = row.odds;
        }
      }

      latest.set(fixture.id, {
        bookmaker: bestOneXTwo.bookmaker,
        snapshotAt: bestOneXTwo.snapshotAt,
        homeOdds: bestOneXTwo.homeOdds,
        drawOdds: bestOneXTwo.drawOdds,
        awayOdds: bestOneXTwo.awayOdds,
        overUnderOdds: {
          OVER_1_5:
            findLatestPickOdds(Market.OVER_UNDER, 'OVER_1_5') ?? undefined,
          UNDER_1_5:
            findLatestPickOdds(Market.OVER_UNDER, 'UNDER_1_5') ?? undefined,
          OVER: findLatestPickOdds(Market.OVER_UNDER, 'OVER') ?? undefined,
          UNDER: findLatestPickOdds(Market.OVER_UNDER, 'UNDER') ?? undefined,
          OVER_3_5:
            findLatestPickOdds(Market.OVER_UNDER, 'OVER_3_5') ?? undefined,
          UNDER_3_5:
            findLatestPickOdds(Market.OVER_UNDER, 'UNDER_3_5') ?? undefined,
        },
        bttsYesOdds: findLatestPickOdds(Market.BTTS, 'YES'),
        bttsNoOdds: findLatestPickOdds(Market.BTTS, 'NO'),
        htftOdds,
        ouHtOdds,
        firstHalfWinnerOdds,
      });
    }

    return latest;
  }

  private async writeBacktestAnalysisLog(
    entries: BacktestAnalysisEntry[],
    metadata: Record<string, number | string | null>,
  ): Promise<void> {
    const logDir = process.env['LOG_DIR'] ?? path.join(process.cwd(), 'logs');
    const destination = path.join(logDir, BACKTEST_ANALYSIS_LOG_FILE);
    const generatedAt = new Date().toISOString();
    const reasonCounts = entries.reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.reason] = (acc[entry.reason] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const lines = [
      JSON.stringify({
        type: 'meta',
        generatedAt,
        entryCount: entries.length,
        reasonCounts,
        ...metadata,
      }),
      ...entries.map((entry) => JSON.stringify(entry)),
    ];

    await mkdir(logDir, { recursive: true });
    await writeFile(destination, `${lines.join('\n')}\n`, 'utf8');

    logger.info(
      { destination, entryCount: entries.length, ...metadata },
      'Backtest analysis log written',
    );
  }

  // ─── Safe value backtest ───────────────────────────────────────────────────

  async runAllSeasonsSafeValueBacktest(): Promise<SafeValueBacktestReport> {
    const seasons = await this.prisma.client.season.findMany({
      where: { competition: { includeInBacktest: true } },
      select: {
        id: true,
        competition: { select: { code: true, name: true } },
      },
    });

    logger.info(
      { seasonCount: seasons.length },
      'Starting safe value backtest (all seasons)',
    );

    const allEntries: SafeValuePickEntry[] = [];
    const seasonResults: SafeValueSeasonResult[] = [];

    for (const season of seasons) {
      const entries = await this.collectSafeValuePicksForSeason(
        season.id,
        season.competition.code,
        season.competition.name,
      );

      // Per-season pick-level stats
      let picksPlaced = 0;
      let wins = 0;
      let losses = 0;
      let voids = 0;
      let profitTotal = new Decimal(0);
      let probTotal = new Decimal(0);
      let oddsTotal = new Decimal(0);
      let evTotal = new Decimal(0);
      const datesInSeason = new Set<string>();

      for (const entry of entries) {
        picksPlaced++;
        if (entry.result === 'WIN') wins++;
        if (entry.result === 'LOSS') losses++;
        if (entry.result === 'VOID') voids++;
        profitTotal = profitTotal.plus(entry.profit);
        if (entry.result !== 'VOID') {
          probTotal = probTotal.plus(entry.pick.probability);
          oddsTotal = oddsTotal.plus(entry.pick.odds);
          evTotal = evTotal.plus(entry.pick.ev);
        }
        datesInSeason.add(entry.fixture.scheduledAt.toISOString().slice(0, 10));
      }

      const stake = picksPlaced - voids;
      seasonResults.push({
        seasonId: season.id,
        competitionCode: season.competition.code,
        competitionName: season.competition.name,
        picksPlaced,
        wins,
        losses,
        voids,
        profit: profitTotal,
        roi: stake > 0 ? profitTotal.div(stake).toNumber() : 0,
        winRate: stake > 0 ? wins / stake : 0,
        avgProbability: stake > 0 ? probTotal.div(stake).toNumber() : 0,
        avgOdds: stake > 0 ? oddsTotal.div(stake).toNumber() : 0,
        avgEv: stake > 0 ? evTotal.div(stake).toNumber() : 0,
        daysWithPicks: datesInSeason.size,
      });

      allEntries.push(...entries);
    }

    const picksByDate = new Map<string, SafeValuePickEntry[]>();
    for (const entry of allEntries) {
      const dateKey = entry.fixture.scheduledAt.toISOString().slice(0, 10);
      const bucket = picksByDate.get(dateKey) ?? [];
      bucket.push(entry);
      picksByDate.set(dateKey, bucket);
    }

    let daysWithPicks = 0;
    for (const _dayPicks of picksByDate.values()) {
      daysWithPicks++;
    }

    const totalPicks = seasonResults.reduce((s, r) => s + r.picksPlaced, 0);
    const totalWins = seasonResults.reduce((s, r) => s + r.wins, 0);
    const totalLosses = seasonResults.reduce((s, r) => s + r.losses, 0);
    const totalVoids = seasonResults.reduce((s, r) => s + r.voids, 0);
    const totalStake = totalPicks - totalVoids;
    const totalProfit = seasonResults.reduce(
      (s, r) => s.plus(r.profit),
      new Decimal(0),
    );
    const seasonsWithPicks = seasonResults.filter((r) => r.picksPlaced > 0);
    const competitions = buildSafeValueCompetitionResults(allEntries);
    const aggregateMarketPerformance =
      buildSafeValueMarketPerformance(allEntries);
    const totalEvSum = seasonsWithPicks.reduce(
      (sum, season) => sum + season.avgEv * (season.picksPlaced - season.voids),
      0,
    );

    const report: SafeValueBacktestReport = {
      seasons: seasonResults,
      competitions,
      aggregate: {
        picksPlaced: totalPicks,
        wins: totalWins,
        losses: totalLosses,
        voids: totalVoids,
        profit: totalProfit,
        winRate: totalStake > 0 ? totalWins / totalStake : 0,
        roi: totalStake > 0 ? totalProfit.div(totalStake).toNumber() : 0,
        avgProbability:
          totalStake > 0
            ? seasonsWithPicks.reduce(
                (sum, season) =>
                  sum +
                  season.avgProbability * (season.picksPlaced - season.voids),
                0,
              ) / totalStake
            : 0,
        avgOdds:
          totalStake > 0
            ? seasonsWithPicks.reduce(
                (sum, season) =>
                  sum + season.avgOdds * (season.picksPlaced - season.voids),
                0,
              ) / totalStake
            : 0,
        avgEv: totalStake > 0 ? totalEvSum / totalStake : 0,
        daysWithPicks,
        marketPerformance: aggregateMarketPerformance,
      },
      generatedAt: new Date(),
    };

    logger.info(
      {
        totalPicks,
        totalWins,
        winRate: report.aggregate.winRate,
        roi: report.aggregate.roi,
        daysWithPicks,
      },
      'Safe value backtest complete',
    );

    return report;
  }

  private async collectSafeValuePicksForSeason(
    seasonId: string,
    competitionCode: string,
    competitionName: string,
  ): Promise<SafeValuePickEntry[]> {
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
    const crossCompStatsByTeam = isEuropeanCompetition(competitionCode)
      ? await this.loadCrossCompStatsIndex(seasonId, [
          ...new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId])),
        ])
      : new Map<string, TeamStatsIndexEntry[]>();
    const oddsByFixture =
      await this.loadLatestOddsSnapshotsForFixtures(fixtures);

    const modelScoreThreshold = getModelScoreThreshold(competitionCode);
    const entries: SafeValuePickEntry[] = [];

    for (const fixture of fixtures) {
      if (fixture.homeScore === null || fixture.awayScore === null) continue;

      const homeStatsRaw = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.homeTeamId) ?? [],
        fixture,
        BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS,
      );
      const awayStatsRaw = findLatestStatsBeforeFixture(
        teamStatsByTeam.get(fixture.awayTeamId) ?? [],
        fixture,
        BACKTEST_CONSTANTS.MIN_PRIOR_TEAM_STATS,
      );
      const homeCross = findLatestStatsBeforeFixture(
        crossCompStatsByTeam.get(fixture.homeTeamId) ?? [],
        fixture,
        0,
      );
      const awayCross = findLatestStatsBeforeFixture(
        crossCompStatsByTeam.get(fixture.awayTeamId) ?? [],
        fixture,
        0,
      );

      const homeStats: TeamStatsInput | null = (() => {
        if (!homeStatsRaw) return homeCross ?? null;
        if (homeCross)
          return blendTeamStats({
            primary: homeStatsRaw,
            secondary: homeCross,
            formWeight: EUROPEAN_CROSS_COMP_FORM_WEIGHT,
            xgWeight: EUROPEAN_CROSS_COMP_XG_WEIGHT,
          });
        return homeStatsRaw;
      })();
      const awayStats: TeamStatsInput | null = (() => {
        if (!awayStatsRaw) return awayCross ?? null;
        if (awayCross)
          return blendTeamStats({
            primary: awayStatsRaw,
            secondary: awayCross,
            formWeight: EUROPEAN_CROSS_COMP_FORM_WEIGHT,
            xgWeight: EUROPEAN_CROSS_COMP_XG_WEIGHT,
          });
        return awayStatsRaw;
      })();

      if (!homeStats || !awayStats) continue;

      const computed = this.bettingEngine.computeFromTeamStats(
        homeStats,
        awayStats,
        undefined,
        competitionCode,
      );
      const odds = oddsByFixture.get(fixture.id);
      if (!odds) continue;
      if (computed.deterministicScore.lessThan(modelScoreThreshold)) continue;

      const { distHome, distAway } = buildPoissonDistributions(
        computed.lambda.home,
        computed.lambda.away,
      );
      const lambdaFloorHit =
        computed.lambda.home <= Number.EPSILON + 0.05 ||
        computed.lambda.away <= Number.EPSILON + 0.05;

      const evaluatedPicks = this.bettingEngine.listEvaluatedPicksForBacktest({
        probabilities: computed.probabilities,
        odds,
        deterministicScore: computed.deterministicScore,
        distHome,
        distAway,
        lambdaFloorHit,
        competitionCode,
      });

      // Mirror production: exclude the EV pick from the safe value pool
      const evPick = this.bettingEngine.selectBestViablePickForBacktest({
        probabilities: computed.probabilities,
        odds,
        deterministicScore: computed.deterministicScore,
        distHome,
        distAway,
        lambdaFloorHit,
        competitionCode,
      });
      const evPickKey = evPick ? `${evPick.market}|${evPick.pick}|-|-` : null;

      const svPick = this.bettingEngine.selectSafeValuePickForBacktest({
        evaluatedPicks,
        evPickKey,
      });
      if (!svPick) continue;

      const simulation = simulatePick(fixture, svPick);
      if (!simulation.placed) continue;

      entries.push({
        seasonId,
        competitionCode,
        competitionName,
        pick: svPick,
        fixture,
        result: simulation.result,
        profit: simulation.profit,
      });
    }

    return entries;
  }
}

function buildMarketSummaries(
  reports: BacktestReport[],
): ValidationMarketSummary[] {
  return aggregateMarketPerformance(
    reports.flatMap((report) => report.marketPerformance),
  ).map((market) => {
    const insufficient =
      market.betsPlaced < BACKTEST_CONSTANTS.MIN_BETS_FOR_ROI;
    const roiVerdict: ValidationVerdict = insufficient
      ? 'INSUFFICIENT_DATA'
      : market.roi.greaterThanOrEqualTo(BACKTEST_CONSTANTS.ROI_FLOOR_THRESHOLD)
        ? 'PASS'
        : 'FAIL';

    return {
      market: market.market,
      betsPlaced: market.betsPlaced,
      wins: market.wins,
      losses: market.losses,
      voids: market.voids,
      stake: market.stake,
      aggregateProfit: market.profit,
      aggregateRoi: market.roi,
      averageOdds: market.averageOdds,
      averageEvSimulated: market.averageEv,
      maxDrawdownSimulated: market.maxDrawdown,
      roi: {
        value: market.roi,
        threshold: BACKTEST_CONSTANTS.ROI_FLOOR_THRESHOLD,
        verdict: roiVerdict,
      },
      pickBreakdown: market.pickBreakdown,
      oddsBuckets: market.oddsBuckets,
    };
  });
}

function buildSafeValueCompetitionResults(
  entries: SafeValuePickEntry[],
): SafeValueCompetitionResult[] {
  const byCompetition = new Map<
    string,
    {
      competitionCode: string;
      competitionName: string;
      entries: SafeValuePickEntry[];
    }
  >();

  for (const entry of entries) {
    const current = byCompetition.get(entry.competitionCode);
    if (current) {
      current.entries.push(entry);
      continue;
    }

    byCompetition.set(entry.competitionCode, {
      competitionCode: entry.competitionCode,
      competitionName: entry.competitionName,
      entries: [entry],
    });
  }

  return Array.from(
    byCompetition.values(),
    ({ entries, competitionCode, competitionName }) =>
      buildSafeValueSummary({
        entries,
        competitionCode,
        competitionName,
      }),
  ).sort((a, b) => b.picksPlaced - a.picksPlaced);
}

function buildSafeValueSummary(input: {
  entries: SafeValuePickEntry[];
  competitionCode: string;
  competitionName: string;
}): SafeValueCompetitionResult {
  let picksPlaced = 0;
  let wins = 0;
  let losses = 0;
  let voids = 0;
  let profit = new Decimal(0);
  let probabilityTotal = new Decimal(0);
  let oddsTotal = new Decimal(0);
  let evTotal = new Decimal(0);
  const daysWithPicks = new Set<string>();

  for (const entry of input.entries) {
    picksPlaced++;
    if (entry.result === 'WIN') wins++;
    if (entry.result === 'LOSS') losses++;
    if (entry.result === 'VOID') voids++;
    profit = profit.plus(entry.profit);
    if (entry.result !== 'VOID') {
      probabilityTotal = probabilityTotal.plus(entry.pick.probability);
      oddsTotal = oddsTotal.plus(entry.pick.odds);
      evTotal = evTotal.plus(entry.pick.ev);
    }
    daysWithPicks.add(entry.fixture.scheduledAt.toISOString().slice(0, 10));
  }

  const stake = picksPlaced - voids;

  return {
    competitionCode: input.competitionCode,
    competitionName: input.competitionName,
    picksPlaced,
    wins,
    losses,
    voids,
    profit,
    roi: stake > 0 ? profit.div(stake).toNumber() : 0,
    winRate: stake > 0 ? wins / stake : 0,
    avgProbability: stake > 0 ? probabilityTotal.div(stake).toNumber() : 0,
    avgOdds: stake > 0 ? oddsTotal.div(stake).toNumber() : 0,
    avgEv: stake > 0 ? evTotal.div(stake).toNumber() : 0,
    daysWithPicks: daysWithPicks.size,
    marketPerformance: buildSafeValueMarketPerformance(input.entries),
  };
}

function buildSafeValueMarketPerformance(
  entries: SafeValuePickEntry[],
): BacktestMarketPerformance[] {
  const byMarket = new Map<Market, MarketAccumulator>();

  for (const entry of entries) {
    const stats = getOrCreateMarketAccumulator(byMarket, entry.pick.market);
    const pickLabel = getSafeValuePickLabel(entry.pick);
    const bucketLabel = getOddsBucketLabel(entry.pick.odds);

    stats.betsPlaced++;
    if (entry.result !== 'VOID') {
      stats.stake = stats.stake.plus(1);
    }
    stats.profit = stats.profit.plus(entry.profit);
    stats.oddsTotal = stats.oddsTotal.plus(entry.pick.odds);
    stats.evTotal = stats.evTotal.plus(entry.pick.ev);
    stats.equity = stats.equity.plus(entry.profit);
    stats.equityPeak = Decimal.max(stats.equityPeak, stats.equity);
    stats.maxDrawdown = Decimal.max(
      stats.maxDrawdown,
      stats.equityPeak.minus(stats.equity),
    );
    if (entry.result === 'WIN') stats.wins++;
    if (entry.result === 'LOSS') stats.losses++;
    if (entry.result === 'VOID') stats.voids++;

    const pickStats = getOrCreatePickAccumulator(stats.picks, pickLabel);
    pickStats.betsPlaced++;
    if (entry.result !== 'VOID') {
      pickStats.stake = pickStats.stake.plus(1);
    }
    pickStats.profit = pickStats.profit.plus(entry.profit);
    pickStats.oddsTotal = pickStats.oddsTotal.plus(entry.pick.odds);
    pickStats.evTotal = pickStats.evTotal.plus(entry.pick.ev);
    if (entry.result === 'WIN') pickStats.wins++;
    if (entry.result === 'LOSS') pickStats.losses++;
    if (entry.result === 'VOID') pickStats.voids++;

    const bucketStats = getOrCreateBucketAccumulator(
      stats.buckets,
      bucketLabel,
    );
    bucketStats.betsPlaced++;
    if (entry.result !== 'VOID') {
      bucketStats.stake = bucketStats.stake.plus(1);
    }
    bucketStats.profit = bucketStats.profit.plus(entry.profit);
    bucketStats.oddsTotal = bucketStats.oddsTotal.plus(entry.pick.odds);
    bucketStats.evTotal = bucketStats.evTotal.plus(entry.pick.ev);
    if (entry.result === 'WIN') bucketStats.wins++;
    if (entry.result === 'LOSS') bucketStats.losses++;
    if (entry.result === 'VOID') bucketStats.voids++;
  }

  return Array.from(byMarket.values(), (stats) =>
    buildMarketPerformance(stats),
  ).sort((a, b) => a.market.localeCompare(b.market));
}

function getSafeValuePickLabel(pick: ViablePick): string {
  if (pick.comboMarket && pick.comboPick) {
    return `${pick.pick} + ${pick.comboPick}`;
  }
  return pick.pick;
}

function buildPredictionCandidate(
  probabilities: {
    home: Decimal;
    draw: Decimal;
    away: Decimal;
  },
  actual: 'HOME' | 'DRAW' | 'AWAY',
): PredictionCandidate {
  const pHome = probabilities.home.toNumber();
  const pDraw = probabilities.draw.toNumber();
  const pAway = probabilities.away.toNumber();

  const pick =
    pHome >= pDraw && pHome >= pAway
      ? 'HOME'
      : pDraw >= pAway
        ? 'DRAW'
        : 'AWAY';
  const probability = Math.max(pHome, pDraw, pAway);

  return {
    probability,
    correct: pick === actual,
  };
}

function buildPredictionBacktestSummary(
  competitionCode: string | null,
  candidates: PredictionCandidate[],
): PredictionBacktestSummary {
  const config = getPredictionConfig(competitionCode);
  const thresholds = buildPredictionThresholdGrid(config.threshold).map(
    (threshold) =>
      summarizePredictionThreshold(candidates, threshold, config.minSampleN),
  );
  const current =
    thresholds.find((entry) => entry.threshold === config.threshold) ??
    summarizePredictionThreshold(
      candidates,
      config.threshold,
      config.minSampleN,
    );

  return {
    enabled: config.enabled,
    threshold: config.threshold,
    minSampleN: config.minSampleN,
    total: current.total,
    predicted: current.predicted,
    correct: current.correct,
    hitRate: current.hitRate,
    coverageRate: current.coverageRate,
    verdict: current.verdict,
    thresholds,
  };
}

function buildCompetitionPredictionBacktest(
  competitionCode: string,
  reports: BacktestReport[],
): PredictionBacktestResult | null {
  const summaries = reports.map((report) => report.predictionBacktest);
  if (summaries.length === 0) return null;

  const currentConfig = getPredictionConfig(competitionCode);
  const thresholdGrid = buildPredictionThresholdGrid(currentConfig.threshold);
  const thresholds = thresholdGrid.map((threshold) => {
    const aggregate = summaries.reduce(
      (acc, summary) => {
        const entry = summary.thresholds.find(
          (item) => item.threshold === threshold,
        );
        if (!entry) return acc;
        acc.total += entry.total;
        acc.predicted += entry.predicted;
        acc.correct += entry.correct;
        return acc;
      },
      { total: 0, predicted: 0, correct: 0 },
    );

    return summarizePredictionTotals(
      aggregate.total,
      aggregate.predicted,
      aggregate.correct,
      threshold,
      currentConfig.minSampleN,
    );
  });

  const current =
    thresholds.find((entry) => entry.threshold === currentConfig.threshold) ??
    summarizePredictionThreshold(
      [],
      currentConfig.threshold,
      currentConfig.minSampleN,
    );
  const recommendation = buildPredictionCalibrationRecommendation(
    currentConfig.enabled,
    current,
    thresholds,
    currentConfig.minSampleN,
  );

  return {
    competition: competitionCode,
    enabled: currentConfig.enabled,
    threshold: currentConfig.threshold,
    minSampleN: currentConfig.minSampleN,
    total: current.total,
    predicted: current.predicted,
    correct: current.correct,
    hitRate: current.hitRate,
    coverageRate: current.coverageRate,
    verdict: current.verdict,
    thresholds,
    recommendation,
  };
}

// eslint-disable-next-line max-params
function buildPredictionCalibrationRecommendation(
  enabled: boolean,
  current: PredictionThresholdBacktest,
  thresholds: PredictionThresholdBacktest[],
  minSampleN: number,
): PredictionCalibrationRecommendation {
  const passing = thresholds.filter((entry) => entry.verdict === 'PASS');
  const lowerPassing = passing.filter(
    (entry) => entry.threshold < current.threshold,
  );
  const higherPassing = passing.filter(
    (entry) => entry.threshold > current.threshold,
  );

  if (!enabled) {
    const candidate = passing[0];
    if (!candidate) {
      return {
        enabled: false,
        threshold: current.threshold,
        reason:
          'Canal désactivé: aucun seuil ne valide simultanément hit rate, couverture et volume minimal.',
      };
    }

    return {
      enabled: true,
      threshold: candidate.threshold,
      reason: `Canal désactivé aujourd'hui, mais ${formatPct(candidate.hitRate)} sur ${candidate.predicted} prédictions à ${candidate.threshold.toFixed(2)} valide une activation.`,
    };
  }

  if (current.verdict === 'PASS') {
    if (
      current.hitRate > PREDICTION_LOWERING_HIT_RATE &&
      lowerPassing.length > 0
    ) {
      const candidate = lowerPassing[0];
      return {
        enabled: true,
        threshold: candidate.threshold,
        reason: `Hit rate solide (${formatPct(current.hitRate)}). Abaisser à ${candidate.threshold.toFixed(2)} augmente la couverture à ${formatPct(candidate.coverageRate)} tout en restant valide.`,
      };
    }

    return {
      enabled: true,
      threshold: current.threshold,
      reason: `Seuil actuel validé: ${formatPct(current.hitRate)} de hit rate pour ${current.predicted} prédictions.`,
    };
  }

  const lacksVolume =
    current.predicted < minSampleN ||
    current.coverageRate < PREDICTION_VALIDATION_COVERAGE_RATE;
  if (lacksVolume) {
    const candidate = lowerPassing[0];
    if (candidate) {
      return {
        enabled: true,
        threshold: candidate.threshold,
        reason: `Seuil actuel trop strict (${current.predicted} prédictions, couverture ${formatPct(current.coverageRate)}). ${candidate.threshold.toFixed(2)} restaure un volume valide.`,
      };
    }

    return {
      enabled: false,
      threshold: current.threshold,
      reason:
        'Seuil actuel trop strict et aucun seuil plus bas ne respecte les critères minimaux de couverture et de volume.',
    };
  }

  const candidate = higherPassing[0];
  if (candidate) {
    return {
      enabled: true,
      threshold: candidate.threshold,
      reason: `Hit rate sous le plancher à ${current.threshold.toFixed(2)} (${formatPct(current.hitRate)}). Monter à ${candidate.threshold.toFixed(2)} repasse en zone valide.`,
    };
  }

  return {
    enabled: false,
    threshold: current.threshold,
    reason:
      'Aucun seuil ne maintient un hit rate valide avec le volume actuel. Désactivation recommandée en attendant recalibration.',
  };
}

function buildPredictionThresholdGrid(currentThreshold: number): number[] {
  return Array.from(
    new Set([...PREDICTION_THRESHOLD_SCAN, currentThreshold]),
  ).sort((a, b) => a - b);
}

function summarizePredictionThreshold(
  candidates: PredictionCandidate[],
  threshold: number,
  minSampleN: number,
): PredictionThresholdBacktest {
  const predictedCandidates = candidates.filter(
    (candidate) => candidate.probability >= threshold,
  );
  const predicted = predictedCandidates.length;
  const correct = predictedCandidates.filter(
    (candidate) => candidate.correct,
  ).length;

  return summarizePredictionTotals(
    candidates.length,
    predicted,
    correct,
    threshold,
    minSampleN,
  );
}

// eslint-disable-next-line max-params
function summarizePredictionTotals(
  total: number,
  predicted: number,
  correct: number,
  threshold: number,
  minSampleN: number,
): PredictionThresholdBacktest {
  const hitRate = predicted > 0 ? correct / predicted : 0;
  const coverageRate = total > 0 ? predicted / total : 0;
  const verdict: ValidationVerdict =
    predicted < minSampleN
      ? 'INSUFFICIENT_DATA'
      : hitRate >= PREDICTION_VALIDATION_HIT_RATE &&
          coverageRate >= PREDICTION_VALIDATION_COVERAGE_RATE
        ? 'PASS'
        : 'FAIL';

  return {
    threshold,
    total,
    predicted,
    correct,
    hitRate,
    coverageRate,
    verdict,
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function buildCompetitionReport(input: {
  competition: { id: string; code: string; name: string };
  seasonFilter: string | null;
  reports: BacktestReport[];
}): CompetitionBacktestReport {
  const { competition, seasonFilter, reports } = input;

  const totalFixtures = reports.reduce((sum, r) => sum + r.fixtureCount, 0);
  const totalAnalyzed = reports.reduce((sum, r) => sum + r.analyzedCount, 0);
  const totalBets = reports.reduce((s, r) => s + getTotalBets(r), 0);

  const averageBrierScore =
    reports.length > 0
      ? reports
          .reduce((s, r) => s.plus(r.brierScore), new Decimal(0))
          .div(reports.length)
      : new Decimal(0);
  const averageCalibrationError =
    reports.length > 0
      ? reports
          .reduce((s, r) => s.plus(r.calibrationError), new Decimal(0))
          .div(reports.length)
      : new Decimal(0);
  const aggregateProfit = reports.reduce(
    (sum, r) => sum.plus(sumProfit(r.marketPerformance)),
    new Decimal(0),
  );
  const aggregateRoi =
    totalBets > 0 ? aggregateProfit.div(totalBets) : new Decimal(0);
  const averageEvSimulated =
    totalBets > 0
      ? reports
          .reduce(
            (sum, r) => sum.plus(r.averageEvSimulated.mul(getTotalBets(r))),
            new Decimal(0),
          )
          .div(totalBets)
      : new Decimal(0);
  const marketPerformance = aggregateMarketPerformance(
    reports.flatMap((report) => report.marketPerformance),
  );
  const maxDrawdownSimulated = marketPerformance.reduce(
    (max, market) =>
      market.maxDrawdown.greaterThan(max) ? market.maxDrawdown : max,
    new Decimal(0),
  );
  const byMarket = buildMarketSummaries(reports);
  const predictionBacktest = buildCompetitionPredictionBacktest(
    competition.code,
    reports,
  );

  const insufficient =
    totalAnalyzed < BACKTEST_CONSTANTS.MIN_FIXTURES_FOR_VALIDATION;

  const brierThreshold = getBrierScorePassThreshold(competition.code);
  const brierVerdict: ValidationVerdict = insufficient
    ? 'INSUFFICIENT_DATA'
    : averageBrierScore.lessThanOrEqualTo(brierThreshold)
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
    : aggregateRoi.greaterThanOrEqualTo(BACKTEST_CONSTANTS.ROI_FLOOR_THRESHOLD)
      ? 'PASS'
      : 'FAIL';

  const brierScore: MetricResult = {
    value: averageBrierScore,
    threshold: brierThreshold,
    verdict: brierVerdict,
  };
  const calibrationErrorMetric: MetricResult = {
    value: averageCalibrationError,
    threshold: BACKTEST_CONSTANTS.CALIBRATION_ERROR_PASS_THRESHOLD,
    verdict: calibrationVerdict,
  };
  const roi: MetricResult = {
    value: aggregateRoi,
    threshold: BACKTEST_CONSTANTS.ROI_FLOOR_THRESHOLD,
    verdict: roiVerdict,
  };

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

  return {
    competitionId: competition.id,
    competitionCode: competition.code,
    competitionName: competition.name,
    seasonFilter,
    seasons: reports,
    seasonCount: reports.length,
    totalFixtures,
    totalAnalyzed,
    totalBets,
    averageBrierScore,
    averageCalibrationError,
    aggregateRoi,
    aggregateProfit,
    averageEvSimulated,
    maxDrawdownSimulated,
    brierScore,
    calibrationError: calibrationErrorMetric,
    roi,
    overallVerdict,
    predictionBacktest,
    marketPerformance,
    byMarket,
    reportGeneratedAt: new Date(),
  };
}

function buildAnalysisEntry(input: {
  seasonId: string;
  competitionCode?: string;
  fixture: FixtureForBacktest;
  actualOutcome: 'HOME' | 'DRAW' | 'AWAY' | null;
  reason: BacktestAnalysisReason;
  homeStatsAvailable: boolean;
  awayStatsAvailable: boolean;
  oddsAvailable: boolean;
  deterministicScore?: Decimal;
  modelScoreThreshold?: Decimal;
  bookmaker?: string;
  oddsSnapshotAt?: Date;
  market?: Market;
  pick?: string;
  oddsValue?: Decimal;
  ev?: Decimal;
  qualityScore?: Decimal;
  result?: 'WIN' | 'LOSS' | 'VOID';
  profit?: Decimal;
  rejectionReason?: string;
  rejectionSummary?: { reason: string; count: number }[];
  topRejectedCandidates?: {
    market: string;
    pick: string;
    comboMarket?: string;
    comboPick?: string;
    odds: string;
    ev: string;
    qualityScore: string;
    rejectionReason: string;
    result: 'WIN' | 'LOSS' | 'VOID';
    profit: string;
  }[];
}): BacktestAnalysisEntry {
  return {
    seasonId: input.seasonId,
    competitionCode: input.competitionCode ?? null,
    fixtureId: input.fixture.id,
    scheduledAt: input.fixture.scheduledAt.toISOString(),
    homeTeamId: input.fixture.homeTeamId,
    awayTeamId: input.fixture.awayTeamId,
    homeScore: input.fixture.homeScore,
    awayScore: input.fixture.awayScore,
    actualOutcome: input.actualOutcome,
    reason: input.reason,
    homeStatsAvailable: input.homeStatsAvailable,
    awayStatsAvailable: input.awayStatsAvailable,
    oddsAvailable: input.oddsAvailable,
    deterministicScore: input.deterministicScore?.toString() ?? null,
    modelScoreThreshold: input.modelScoreThreshold?.toString() ?? null,
    bookmaker: input.bookmaker ?? null,
    oddsSnapshotAt: input.oddsSnapshotAt?.toISOString() ?? null,
    market: input.market ?? null,
    pick: input.pick ?? null,
    odds: input.oddsValue?.toString() ?? null,
    ev: input.ev?.toString() ?? null,
    qualityScore: input.qualityScore?.toString() ?? null,
    result: input.result ?? null,
    profit: input.profit?.toString() ?? null,
    rejectionReason: input.rejectionReason ?? null,
    rejectionSummary: input.rejectionSummary ?? null,
    topRejectedCandidates: input.topRejectedCandidates ?? null,
  };
}

function buildRejectionSummary(
  picks: EvaluatedPick[],
): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const pick of picks) {
    if (!pick.rejectionReason) continue;
    counts.set(
      pick.rejectionReason,
      (counts.get(pick.rejectionReason) ?? 0) + 1,
    );
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
}

function buildTopRejectedCandidates(
  fixture: FixtureForBacktest,
  picks: EvaluatedPick[],
): {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  odds: string;
  ev: string;
  qualityScore: string;
  rejectionReason: string;
  result: 'WIN' | 'LOSS' | 'VOID';
  profit: string;
}[] {
  return picks
    .filter(
      (
        pick,
      ): pick is EvaluatedPick & {
        rejectionReason: NonNullable<EvaluatedPick['rejectionReason']>;
      } => pick.rejectionReason !== undefined,
    )
    .slice(0, 3)
    .map((pick) => {
      const simulation = simulatePick(fixture, pick);
      return {
        market: pick.market,
        pick: pick.pick,
        ...(pick.comboMarket ? { comboMarket: pick.comboMarket } : {}),
        ...(pick.comboPick ? { comboPick: pick.comboPick } : {}),
        odds: pick.odds.toString(),
        ev: pick.ev.toString(),
        qualityScore: pick.qualityScore.toString(),
        rejectionReason: pick.rejectionReason,
        result: simulation.result,
        profit: simulation.profit.toString(),
      };
    });
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
  if (bookmaker === 'Unibet') return 2;
  if (bookmaker === 'Marathonbet') return 3;
  if (bookmaker === 'Bwin') return 4;
  if (bookmaker === 'MarketAvg') return 5;
  return 6;
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
        : pick.market === Market.OVER_UNDER_HT ||
            pick.market === Market.FIRST_HALF_WINNER
          ? resolveFirstHalfBetStatus(
              pick.pick,
              fixture.homeHtScore,
              fixture.awayHtScore,
            )
          : resolvePickBetStatus(
              pick.pick,
              fixture.homeScore,
              fixture.awayScore,
            );

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
