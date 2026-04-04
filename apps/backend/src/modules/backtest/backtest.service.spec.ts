import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { BacktestService } from './backtest.service';
import { BACKTEST_CONSTANTS } from './backtest.constants';
import type { PrismaService } from '@/prisma.service';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { ViablePick } from '@modules/betting-engine/betting-engine.types';

// Generates N team-stats rows for a given teamId, all dated before 2023-01-01
// so they pass the cold-start guard (MIN_PRIOR_TEAM_STATS = 5).
function makeTeamStatsRows(teamId: string, n: number) {
  const months = ['08', '09', '10', '11', '12'];
  return Array.from({ length: n }, (_, i) => ({
    teamId,
    afterFixtureId: `af-${teamId}-${i}`,
    recentForm: new Decimal('0.6'),
    xgFor: new Decimal('1.5'),
    xgAgainst: new Decimal('1.2'),
    homeWinRate: new Decimal('0.55'),
    awayWinRate: new Decimal('0.32'),
    drawRate: new Decimal('0.22'),
    leagueVolatility: new Decimal('1.4'),
    afterFixture: {
      scheduledAt: new Date(`2022-${months[i % 5]}-${10 + i}T12:00:00.000Z`),
    },
  }));
}

describe('BacktestService', () => {
  it('runs backtest and aggregates analyzed/skipped fixtures', async () => {
    const prismaMock = {
      client: {
        fixture: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'f1',
              seasonId: 's1',
              scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
              homeTeamId: 'h1',
              awayTeamId: 'a1',
              homeHtScore: 1,
              awayHtScore: 0,
              homeScore: 2,
              awayScore: 1,
            },
            {
              id: 'f2',
              seasonId: 's1',
              scheduledAt: new Date('2023-01-08T12:00:00.000Z'),
              homeTeamId: 'h2',
              awayTeamId: 'a2',
              homeHtScore: 0,
              awayHtScore: 0,
              homeScore: 0,
              awayScore: 0,
            },
          ]),
        },
        teamStats: {
          // 5 entries per team → satisfies MIN_PRIOR_TEAM_STATS cold-start guard
          findMany: vi
            .fn()
            .mockResolvedValue([
              ...makeTeamStatsRows('h1', 5),
              ...makeTeamStatsRows('a1', 5),
            ]),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              fixtureId: 'f1',
              bookmaker: 'Pinnacle',
              market: Market.ONE_X_TWO,
              pick: null,
              snapshotAt: new Date('2022-12-31T10:00:00.000Z'),
              homeOdds: new Decimal('2.1'),
              drawOdds: new Decimal('3.4'),
              awayOdds: new Decimal('4.2'),
              odds: null,
            },
          ]),
        },
      },
    } as unknown as PrismaService;

    const bettingMock = {
      computeFromTeamStats: vi.fn().mockReturnValue({
        deterministicScore: new Decimal('0.66'),
        lambda: { home: 1.4, away: 1.1 },
        probabilities: {
          home: new Decimal('0.6'),
          draw: new Decimal('0.2'),
          away: new Decimal('0.2'),
          over25: new Decimal('0.4'),
          under25: new Decimal('0.6'),
          bttsYes: new Decimal('0.5'),
          bttsNo: new Decimal('0.5'),
          dc1X: new Decimal('0.8'),
          dcX2: new Decimal('0.4'),
          dc12: new Decimal('0.8'),
        },
        features: {
          recentForm: new Decimal('0.7'),
          xg: new Decimal('0.7'),
          domExtPerf: new Decimal('0.6'),
          leagueVolat: new Decimal('0.4'),
        },
      }),
      selectBestViablePickForBacktest: vi.fn().mockReturnValue({
        market: Market.ONE_X_TWO,
        pick: 'HOME',
        probability: new Decimal('0.6'),
        odds: new Decimal('2.1'),
        ev: new Decimal('0.26'),
        qualityScore: new Decimal('0.1716'),
        isCombo: false,
      } satisfies ViablePick),
    } as unknown as BettingEngineService;

    const service = new BacktestService(prismaMock, bettingMock);
    const report = await service.runBacktest('s1');

    expect(report.seasonId).toBe('s1');
    expect(report.fixtureCount).toBe(2);
    expect(report.analyzedCount).toBe(1);
    expect(report.skippedCount).toBe(1);
    expect(report.brierScore.toNumber()).toBeCloseTo(0.24, 6);
    expect(report.calibrationError.toNumber()).toBeCloseTo(0.266666, 5);
    expect(report.roiSimulated.toNumber()).toBeCloseTo(1.1, 6);
    expect(report.averageEvSimulated.toNumber()).toBeCloseTo(0.26, 6);
    expect(report.maxDrawdownSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.marketPerformance).toHaveLength(1);
    expect(report.marketPerformance[0]).toMatchObject({
      market: Market.ONE_X_TWO,
      betsPlaced: 1,
      wins: 1,
      losses: 0,
      voids: 0,
    });
    expect(report.marketPerformance[0].roi.toNumber()).toBeCloseTo(1.1, 6);
    expect(report.marketPerformance[0].averageEv.toNumber()).toBeCloseTo(
      0.26,
      6,
    );
    expect(report.marketPerformance[0].maxDrawdown.toNumber()).toBeCloseTo(
      0,
      6,
    );
  });

  it('passes competitionCode to backtest pick selection', async () => {
    const selectBestViablePickForBacktest = vi.fn().mockReturnValue(null);
    const prismaMock = {
      client: {
        fixture: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'f1',
              seasonId: 's1',
              scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
              homeTeamId: 'h1',
              awayTeamId: 'a1',
              homeHtScore: 1,
              awayHtScore: 0,
              homeScore: 2,
              awayScore: 1,
            },
          ]),
        },
        teamStats: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              ...makeTeamStatsRows('h1', 5),
              ...makeTeamStatsRows('a1', 5),
            ]),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              fixtureId: 'f1',
              bookmaker: 'Pinnacle',
              market: Market.ONE_X_TWO,
              pick: null,
              snapshotAt: new Date('2022-12-31T10:00:00.000Z'),
              homeOdds: new Decimal('2.1'),
              drawOdds: new Decimal('3.4'),
              awayOdds: new Decimal('4.2'),
              odds: null,
            },
          ]),
        },
      },
    } as unknown as PrismaService;

    const bettingMock = {
      computeFromTeamStats: vi.fn().mockReturnValue({
        deterministicScore: new Decimal('0.66'),
        lambda: { home: 1.4, away: 1.1 },
        probabilities: {
          home: new Decimal('0.6'),
          draw: new Decimal('0.2'),
          away: new Decimal('0.2'),
          over25: new Decimal('0.4'),
          under25: new Decimal('0.6'),
          bttsYes: new Decimal('0.5'),
          bttsNo: new Decimal('0.5'),
          dc1X: new Decimal('0.8'),
          dcX2: new Decimal('0.4'),
          dc12: new Decimal('0.8'),
        },
        features: {
          recentForm: new Decimal('0.7'),
          xg: new Decimal('0.7'),
          domExtPerf: new Decimal('0.6'),
          leagueVolat: new Decimal('0.4'),
        },
      }),
      selectBestViablePickForBacktest,
    } as unknown as BettingEngineService;

    const service = new BacktestService(prismaMock, bettingMock);
    await service.runBacktest('s1', 'CH');

    expect(selectBestViablePickForBacktest).toHaveBeenCalledWith(
      expect.objectContaining({ competitionCode: 'CH' }),
    );
  });

  it('does not place simulated bets when best EV is below threshold', async () => {
    const prismaMock = {
      client: {
        fixture: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'f1',
              seasonId: 's1',
              scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
              homeTeamId: 'h1',
              awayTeamId: 'a1',
              homeHtScore: 0,
              awayHtScore: 0,
              homeScore: 1,
              awayScore: 0,
            },
          ]),
        },
        teamStats: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              ...makeTeamStatsRows('h1', 5),
              ...makeTeamStatsRows('a1', 5),
            ]),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              fixtureId: 'f1',
              bookmaker: 'Pinnacle',
              market: Market.ONE_X_TWO,
              pick: null,
              snapshotAt: new Date('2022-12-31T10:00:00.000Z'),
              homeOdds: new Decimal('1.7'),
              drawOdds: new Decimal('3.1'),
              awayOdds: new Decimal('4.0'),
              odds: null,
            },
          ]),
        },
      },
    } as unknown as PrismaService;

    const bettingMock = {
      computeFromTeamStats: vi.fn().mockReturnValue({
        deterministicScore: new Decimal('0.50'),
        lambda: { home: 1.4, away: 1.1 },
        probabilities: {
          home: new Decimal('0.55'),
          draw: new Decimal('0.25'),
          away: new Decimal('0.20'),
          over25: new Decimal('0.4'),
          under25: new Decimal('0.6'),
          bttsYes: new Decimal('0.5'),
          bttsNo: new Decimal('0.5'),
          dc1X: new Decimal('0.8'),
          dcX2: new Decimal('0.45'),
          dc12: new Decimal('0.75'),
        },
        features: {
          recentForm: new Decimal('0.7'),
          xg: new Decimal('0.7'),
          domExtPerf: new Decimal('0.6'),
          leagueVolat: new Decimal('0.4'),
        },
      }),
      selectBestViablePickForBacktest: vi.fn(),
    } as unknown as BettingEngineService;

    const service = new BacktestService(prismaMock, bettingMock);
    const report = await service.runBacktest('s1');

    expect(report.analyzedCount).toBe(1);
    expect(report.roiSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.averageEvSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.maxDrawdownSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.marketPerformance).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Helpers shared across runAllSeasons / getValidationReport tests
// ---------------------------------------------------------------------------

function buildSeasonFixtureMock(seasonId: string) {
  return {
    id: 'f-' + seasonId,
    seasonId,
    scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
    homeTeamId: 'h1',
    awayTeamId: 'a1',
    homeHtScore: 1,
    awayHtScore: 0,
    homeScore: 2,
    awayScore: 1,
  };
}

// 5 entries per team → satisfies MIN_PRIOR_TEAM_STATS for runAllSeasons tests
const sharedTeamStats = [
  ...makeTeamStatsRows('h1', 5),
  ...makeTeamStatsRows('a1', 5),
];

function makeBettingMock(): BettingEngineService {
  return {
    computeFromTeamStats: vi.fn().mockReturnValue({
      deterministicScore: new Decimal('0.66'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.6'),
        draw: new Decimal('0.2'),
        away: new Decimal('0.2'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.8'),
        dcX2: new Decimal('0.4'),
        dc12: new Decimal('0.8'),
      },
      features: {
        recentForm: new Decimal('0.7'),
        xg: new Decimal('0.7'),
        domExtPerf: new Decimal('0.6'),
        leagueVolat: new Decimal('0.4'),
      },
    }),
    selectBestViablePickForBacktest: vi.fn().mockReturnValue({
      market: Market.ONE_X_TWO,
      pick: 'HOME',
      probability: new Decimal('0.6'),
      odds: new Decimal('2.1'),
      ev: new Decimal('0.26'),
      qualityScore: new Decimal('0.1716'),
      isCombo: false,
    } satisfies ViablePick),
  } as unknown as BettingEngineService;
}

describe('BacktestService.runAllSeasons', () => {
  it('aggregates reports from all seasons in the DB', async () => {
    const prismaMock = {
      client: {
        season: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 's1',
              competition: { id: 'c1', code: 'EPL', name: 'Premier League' },
            },
            {
              id: 's2',
              competition: { id: 'c1', code: 'EPL', name: 'Premier League' },
            },
          ]),
        },
        fixture: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([buildSeasonFixtureMock('s1')])
            .mockResolvedValueOnce([buildSeasonFixtureMock('s2')]),
        },
        teamStats: {
          findMany: vi.fn().mockResolvedValue(sharedTeamStats),
        },
        oddsSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());
    const report = await service.runAllSeasons();

    expect(report.seasons).toHaveLength(2);
    expect(report.totalFixtures).toBe(2);
    expect(report.totalAnalyzed).toBe(2);
    expect(report.averageBrierScore).toBeInstanceOf(Decimal);
    // No odds → no bets → aggregate ROI = 0
    expect(report.aggregateRoi.toNumber()).toBeCloseTo(0, 6);
  });

  it('returns zero metrics when no seasons exist', async () => {
    const prismaMock = {
      client: {
        season: { findMany: vi.fn().mockResolvedValue([]) },
        fixture: { findMany: vi.fn().mockResolvedValue([]) },
        teamStats: { findMany: vi.fn().mockResolvedValue([]) },
        oddsSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());
    const report = await service.runAllSeasons();

    expect(report.seasons).toHaveLength(0);
    expect(report.totalFixtures).toBe(0);
    expect(report.totalAnalyzed).toBe(0);
    expect(report.averageBrierScore.toNumber()).toBe(0);
    expect(report.aggregateRoi.toNumber()).toBe(0);
  });

  it('computes competition aggregate ROI from total profit and total bets', async () => {
    const prismaMock = {
      client: {
        season: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 's1',
              competition: { id: 'c1', code: 'CH', name: 'Championship' },
            },
            {
              id: 's2',
              competition: { id: 'c1', code: 'CH', name: 'Championship' },
            },
          ]),
        },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());
    vi.spyOn(service, 'runBacktest')
      .mockResolvedValueOnce({
        seasonId: 's1',
        fixtureCount: 100,
        analyzedCount: 100,
        skippedCount: 0,
        brierScore: new Decimal('0.62'),
        calibrationError: new Decimal('0.03'),
        roiSimulated: new Decimal('-0.20'),
        maxDrawdownSimulated: new Decimal('5'),
        averageEvSimulated: new Decimal('0.30'),
        marketPerformance: [
          {
            market: Market.ONE_X_TWO,
            betsPlaced: 5,
            wins: 2,
            losses: 3,
            voids: 0,
            stake: new Decimal('5'),
            profit: new Decimal('-1'),
            roi: new Decimal('-0.20'),
            averageOdds: new Decimal('2.5'),
            averageEv: new Decimal('0.20'),
            maxDrawdown: new Decimal('2'),
            pickBreakdown: [],
            oddsBuckets: [],
          },
        ],
        reportGeneratedAt: new Date(),
      })
      .mockResolvedValueOnce({
        seasonId: 's2',
        fixtureCount: 100,
        analyzedCount: 100,
        skippedCount: 0,
        brierScore: new Decimal('0.61'),
        calibrationError: new Decimal('0.02'),
        roiSimulated: new Decimal('0.13333333333333333333'),
        maxDrawdownSimulated: new Decimal('2'),
        averageEvSimulated: new Decimal('0.35'),
        marketPerformance: [
          {
            market: Market.ONE_X_TWO,
            betsPlaced: 30,
            wins: 14,
            losses: 16,
            voids: 0,
            stake: new Decimal('30'),
            profit: new Decimal('4'),
            roi: new Decimal('0.13333333333333333333'),
            averageOdds: new Decimal('2.4'),
            averageEv: new Decimal('0.25'),
            maxDrawdown: new Decimal('4'),
            pickBreakdown: [],
            oddsBuckets: [],
          },
        ],
        reportGeneratedAt: new Date(),
      });

    const report = await service.runAllSeasons();

    expect(report.aggregateProfit.toNumber()).toBeCloseTo(3, 6);
    expect(report.aggregateRoi.toNumber()).toBeCloseTo(3 / 35, 6);
    expect(report.byCompetition).toHaveLength(1);
    expect(report.byCompetition[0].aggregateProfit.toNumber()).toBeCloseTo(
      3,
      6,
    );
    expect(report.byCompetition[0].aggregateRoi.toNumber()).toBeCloseTo(
      3 / 35,
      6,
    );
  });
});

describe('BacktestService.getValidationReport', () => {
  it('returns INSUFFICIENT_DATA when analyzed fixture count is below minimum', async () => {
    const prismaMock = {
      client: {
        season: { findMany: vi.fn().mockResolvedValue([]) },
        fixture: { findMany: vi.fn().mockResolvedValue([]) },
        teamStats: { findMany: vi.fn().mockResolvedValue([]) },
        oddsSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());
    const report = await service.getValidationReport();

    expect(report.overallVerdict).toBe('INSUFFICIENT_DATA');
    expect(report.brierScore.verdict).toBe('INSUFFICIENT_DATA');
    expect(report.calibrationError.verdict).toBe('INSUFFICIENT_DATA');
    expect(report.roi.verdict).toBe('INSUFFICIENT_DATA');
    expect(report.totalAnalyzed).toBeLessThan(
      BACKTEST_CONSTANTS.MIN_FIXTURES_FOR_VALIDATION,
    );
  });

  it('returns PASS when all metrics are within MVP thresholds', async () => {
    const prismaMock = {
      client: {
        season: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
        fixture: { findMany: vi.fn() },
        teamStats: { findMany: vi.fn() },
        oddsSnapshot: { findMany: vi.fn() },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());

    vi.spyOn(service, 'runAllSeasons').mockResolvedValue({
      seasons: [],
      totalFixtures: 100,
      totalAnalyzed: 100,
      totalBets: 25,
      averageBrierScore: new Decimal('0.20'),
      averageCalibrationError: new Decimal('0.03'),
      aggregateRoi: new Decimal('0.05'),
      aggregateProfit: new Decimal('1.25'),
      averageEvSimulated: new Decimal('0.12'),
      byCompetition: [],
      reportGeneratedAt: new Date(),
    });

    const report = await service.getValidationReport();

    expect(report.overallVerdict).toBe('PASS');
    expect(report.brierScore.verdict).toBe('PASS');
    expect(report.calibrationError.verdict).toBe('PASS');
    expect(report.roi.verdict).toBe('PASS');
    expect(report.brierScore.threshold).toEqual(
      BACKTEST_CONSTANTS.BRIER_SCORE_PASS_THRESHOLD,
    );
  });

  it('reuses the cached all-seasons report when validation is requested twice', async () => {
    const prismaMock = {
      client: {
        season: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 's1',
              competition: { id: 'c1', code: 'EPL', name: 'Premier League' },
            },
          ]),
        },
        fixture: {
          findMany: vi.fn().mockResolvedValue([buildSeasonFixtureMock('s1')]),
        },
        teamStats: {
          findMany: vi.fn().mockResolvedValue(sharedTeamStats),
        },
        oddsSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());

    await service.getValidationReport();
    await service.getValidationReport();

    expect(prismaMock.client.season.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.client.fixture.findMany).toHaveBeenCalledTimes(1);
  });

  it('refreshValidationReport recomputes all seasons and updates the cache', async () => {
    const prismaMock = {
      client: {
        season: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 's1',
              competition: { id: 'c1', code: 'EPL', name: 'Premier League' },
            },
          ]),
        },
        fixture: {
          findMany: vi.fn().mockResolvedValue([buildSeasonFixtureMock('s1')]),
        },
        teamStats: {
          findMany: vi.fn().mockResolvedValue(sharedTeamStats),
        },
        oddsSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());

    const report = await service.refreshValidationReport();

    expect(report).toEqual(service.getLatestValidationReport());
    expect(service.getLatestAllSeasonsReport()).not.toBeNull();
  });

  it('returns FAIL when Brier Score exceeds threshold', async () => {
    const prismaMock = {
      client: {
        season: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
        fixture: { findMany: vi.fn() },
        teamStats: { findMany: vi.fn() },
        oddsSnapshot: { findMany: vi.fn() },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(prismaMock, makeBettingMock());

    vi.spyOn(service, 'runAllSeasons').mockResolvedValue({
      seasons: [],
      totalFixtures: 100,
      totalAnalyzed: 100,
      totalBets: 25,
      averageBrierScore: new Decimal('0.70'), // above 0.65 threshold → FAIL
      averageCalibrationError: new Decimal('0.03'),
      aggregateRoi: new Decimal('0.05'),
      aggregateProfit: new Decimal('1.25'),
      averageEvSimulated: new Decimal('0.12'),
      byCompetition: [],
      reportGeneratedAt: new Date(),
    });

    const report = await service.getValidationReport();

    expect(report.overallVerdict).toBe('FAIL');
    expect(report.brierScore.verdict).toBe('FAIL');
    expect(report.calibrationError.verdict).toBe('PASS');
    expect(report.roi.verdict).toBe('PASS');
  });
});
