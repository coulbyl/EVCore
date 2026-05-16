import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
import { PrismaService } from '@/prisma.service';
import { BacktestService, type GridSearchParams } from './backtest.service';
import { getBrierScorePassThreshold } from './backtest.constants';

const logger = createLogger('grid-search-service');

const EV_FLOOR_GRID = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2];
const MODEL_SCORE_THRESHOLD_GRID = [0.55, 0.58, 0.6, 0.62, 0.65];
const MIN_BETS_PER_SEASON = 10;

export type GridSearchCandidate = {
  evFloor: number;
  modelScoreThreshold: number;
  trainSeasonCount: number;
  trainBets: number;
  trainRoi: number;
  trainBrierAvg: number;
  testBets: number;
  testRoi: number;
  testBrier: number;
  verdict: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA';
};

export type GridSearchReport = {
  competitionCode: string;
  competitionName: string;
  trainSeasons: string[];
  testSeason: string;
  brierPassThreshold: number;
  minBetsPerSeason: number;
  results: GridSearchCandidate[];
  bestCandidate: GridSearchCandidate | null;
  generatedAt: string;
};

@Injectable()
export class GridSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backtestService: BacktestService,
  ) {}

  async runGridSearch(competitionCode: string): Promise<GridSearchReport> {
    const competition = await this.prisma.client.competition.findUnique({
      where: { code: competitionCode },
      select: { id: true, code: true, name: true },
    });

    if (!competition) {
      throw new Error(`Competition not found for code "${competitionCode}".`);
    }

    const seasons = await this.prisma.client.season.findMany({
      where: { competitionId: competition.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (seasons.length < 2) {
      throw new Error(
        `Grid search requires at least 2 seasons for "${competitionCode}" (${seasons.length} found).`,
      );
    }

    const testSeason = seasons[seasons.length - 1];
    const trainSeasons = seasons.slice(0, -1);

    logger.info(
      {
        competitionCode,
        trainSeasons: trainSeasons.map((s) => s.name),
        testSeason: testSeason.name,
        gridSize: EV_FLOOR_GRID.length * MODEL_SCORE_THRESHOLD_GRID.length,
      },
      'Starting grid search',
    );

    const brierThreshold =
      getBrierScorePassThreshold(competitionCode).toNumber();
    const results: GridSearchCandidate[] = [];

    for (const evFloor of EV_FLOOR_GRID) {
      for (const modelScoreThreshold of MODEL_SCORE_THRESHOLD_GRID) {
        const overrides: GridSearchParams = {
          evFloor: new Decimal(evFloor),
          modelScoreThreshold: new Decimal(modelScoreThreshold),
        };

        // Run on train seasons
        let trainBets = 0;
        let trainRoiProfit = new Decimal(0);
        let trainRoiStake = new Decimal(0);
        let trainBrierSum = new Decimal(0);

        for (const season of trainSeasons) {
          const report = await this.backtestService.runBacktest(
            season.id,
            competitionCode,
            { writeAnalysisLog: false, gridSearchOverrides: overrides },
          );
          trainBets += report.marketPerformance.reduce(
            (sum, m) => sum + m.betsPlaced,
            0,
          );
          const stake = report.marketPerformance.reduce(
            (sum, m) => sum + m.betsPlaced - m.voids,
            0,
          );
          trainRoiStake = trainRoiStake.plus(stake);
          const profit = report.marketPerformance.reduce(
            (sum, m) => sum.plus(m.profit),
            new Decimal(0),
          );
          trainRoiProfit = trainRoiProfit.plus(profit);
          trainBrierSum = trainBrierSum.plus(report.brierScore);
        }

        const trainRoi = trainRoiStake.greaterThan(0)
          ? trainRoiProfit.div(trainRoiStake).toNumber()
          : 0;
        const trainBrierAvg =
          trainSeasons.length > 0
            ? trainBrierSum.div(trainSeasons.length).toNumber()
            : 0;

        // Run on test season
        const testReport = await this.backtestService.runBacktest(
          testSeason.id,
          competitionCode,
          { writeAnalysisLog: false, gridSearchOverrides: overrides },
        );
        const testBets = testReport.marketPerformance.reduce(
          (sum, m) => sum + m.betsPlaced,
          0,
        );
        const testStake = testReport.marketPerformance.reduce(
          (sum, m) => sum + m.betsPlaced - m.voids,
          0,
        );
        const testProfit = testReport.marketPerformance.reduce(
          (sum, m) => sum.plus(m.profit),
          new Decimal(0),
        );
        const testRoi =
          testStake > 0 ? testProfit.div(testStake).toNumber() : 0;
        const testBrier = testReport.brierScore.toNumber();

        const verdict: GridSearchCandidate['verdict'] =
          testBets < MIN_BETS_PER_SEASON
            ? 'INSUFFICIENT_DATA'
            : testBrier <= brierThreshold && testRoi >= 0
              ? 'PASS'
              : 'FAIL';

        results.push({
          evFloor,
          modelScoreThreshold,
          trainSeasonCount: trainSeasons.length,
          trainBets,
          trainRoi,
          trainBrierAvg,
          testBets,
          testRoi,
          testBrier,
          verdict,
        });

        logger.info(
          {
            evFloor,
            modelScoreThreshold,
            trainBets,
            trainRoi: trainRoi.toFixed(4),
            testBets,
            testRoi: testRoi.toFixed(4),
            testBrier: testBrier.toFixed(4),
            verdict,
          },
          'Grid point evaluated',
        );
      }
    }

    results.sort((a, b) => {
      if (a.verdict === 'PASS' && b.verdict !== 'PASS') return -1;
      if (b.verdict === 'PASS' && a.verdict !== 'PASS') return 1;
      return b.testRoi - a.testRoi;
    });

    const bestCandidate = results.find((r) => r.verdict === 'PASS') ?? null;

    const report: GridSearchReport = {
      competitionCode: competition.code,
      competitionName: competition.name,
      trainSeasons: trainSeasons.map((s) => s.name),
      testSeason: testSeason.name,
      brierPassThreshold: brierThreshold,
      minBetsPerSeason: MIN_BETS_PER_SEASON,
      results,
      bestCandidate,
      generatedAt: new Date().toISOString(),
    };

    await this.writeGridSearchReport(report);

    logger.info(
      {
        competitionCode,
        totalCombinations: results.length,
        passingCombinations: results.filter((r) => r.verdict === 'PASS').length,
        bestEvFloor: bestCandidate?.evFloor,
        bestModelScoreThreshold: bestCandidate?.modelScoreThreshold,
        bestTestRoi: bestCandidate?.testRoi?.toFixed(4),
      },
      'Grid search complete',
    );

    return report;
  }

  private async writeGridSearchReport(report: GridSearchReport): Promise<void> {
    const logDir = process.env['LOG_DIR'] ?? path.join(process.cwd(), 'logs');
    await mkdir(logDir, { recursive: true });
    const filename = `grid-search-${report.competitionCode}-${new Date().toISOString().slice(0, 10)}.json`;
    const destination = path.join(logDir, filename);
    await writeFile(destination, JSON.stringify(report, null, 2), 'utf8');
    logger.info({ destination }, 'Grid search report written');
  }
}
