import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { BacktestService } from './backtest.service';
import { BACKTEST_CONSTANTS } from './backtest.constants';
import type { PrismaService } from '@/prisma.service';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import type { NotificationService } from '@modules/notification/notification.service';

const notificationMock = {
  sendBrierScoreAlert: vi.fn().mockResolvedValue(undefined),
} as unknown as NotificationService;

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
              homeScore: 2,
              awayScore: 1,
            },
            {
              id: 'f2',
              seasonId: 's1',
              scheduledAt: new Date('2023-01-08T12:00:00.000Z'),
              homeTeamId: 'h2',
              awayTeamId: 'a2',
              homeScore: 0,
              awayScore: 0,
            },
          ]),
        },
        teamStats: {
          findMany: vi.fn().mockResolvedValue([
            {
              teamId: 'h1',
              afterFixtureId: 'af1',
              recentForm: new Decimal('0.7'),
              xgFor: new Decimal('1.8'),
              xgAgainst: new Decimal('1.1'),
              homeWinRate: new Decimal('0.65'),
              awayWinRate: new Decimal('0.35'),
              drawRate: new Decimal('0.20'),
              leagueVolatility: new Decimal('1.5'),
              afterFixture: {
                scheduledAt: new Date('2022-12-31T12:00:00.000Z'),
              },
            },
            {
              teamId: 'a1',
              afterFixtureId: 'af1',
              recentForm: new Decimal('0.4'),
              xgFor: new Decimal('1.2'),
              xgAgainst: new Decimal('1.6'),
              homeWinRate: new Decimal('0.45'),
              awayWinRate: new Decimal('0.30'),
              drawRate: new Decimal('0.25'),
              leagueVolatility: new Decimal('1.4'),
              afterFixture: {
                scheduledAt: new Date('2022-12-31T12:00:00.000Z'),
              },
            },
          ]),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              fixtureId: 'f1',
              snapshotAt: new Date('2022-12-31T10:00:00.000Z'),
              homeOdds: new Decimal('2.1'),
              drawOdds: new Decimal('3.4'),
              awayOdds: new Decimal('4.2'),
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
    } as unknown as BettingEngineService;

    const service = new BacktestService(
      prismaMock,
      bettingMock,
      notificationMock,
    );
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
              homeScore: 1,
              awayScore: 0,
            },
          ]),
        },
        teamStats: {
          findMany: vi.fn().mockResolvedValue([
            {
              teamId: 'h1',
              afterFixtureId: 'af1',
              recentForm: new Decimal('0.7'),
              xgFor: new Decimal('1.8'),
              xgAgainst: new Decimal('1.1'),
              homeWinRate: new Decimal('0.65'),
              awayWinRate: new Decimal('0.35'),
              drawRate: new Decimal('0.20'),
              leagueVolatility: new Decimal('1.5'),
              afterFixture: {
                scheduledAt: new Date('2022-12-31T12:00:00.000Z'),
              },
            },
            {
              teamId: 'a1',
              afterFixtureId: 'af1',
              recentForm: new Decimal('0.4'),
              xgFor: new Decimal('1.2'),
              xgAgainst: new Decimal('1.6'),
              homeWinRate: new Decimal('0.45'),
              awayWinRate: new Decimal('0.30'),
              drawRate: new Decimal('0.25'),
              leagueVolatility: new Decimal('1.4'),
              afterFixture: {
                scheduledAt: new Date('2022-12-31T12:00:00.000Z'),
              },
            },
          ]),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              fixtureId: 'f1',
              snapshotAt: new Date('2022-12-31T10:00:00.000Z'),
              homeOdds: new Decimal('1.7'),
              drawOdds: new Decimal('3.1'),
              awayOdds: new Decimal('4.0'),
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
    } as unknown as BettingEngineService;

    const service = new BacktestService(
      prismaMock,
      bettingMock,
      notificationMock,
    );
    const report = await service.runBacktest('s1');

    expect(report.analyzedCount).toBe(1);
    expect(report.roiSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.averageEvSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.maxDrawdownSimulated.toNumber()).toBeCloseTo(0, 6);
    expect(report.marketPerformance[0]).toMatchObject({
      market: Market.ONE_X_TWO,
      betsPlaced: 0,
      wins: 0,
      losses: 0,
      voids: 0,
    });
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
    homeScore: 2,
    awayScore: 1,
  };
}

const sharedTeamStats = [
  {
    teamId: 'h1',
    afterFixtureId: 'af1',
    recentForm: new Decimal('0.7'),
    xgFor: new Decimal('1.8'),
    xgAgainst: new Decimal('1.1'),
    homeWinRate: new Decimal('0.65'),
    awayWinRate: new Decimal('0.35'),
    drawRate: new Decimal('0.20'),
    leagueVolatility: new Decimal('1.5'),
    afterFixture: { scheduledAt: new Date('2022-12-31T12:00:00.000Z') },
  },
  {
    teamId: 'a1',
    afterFixtureId: 'af2',
    recentForm: new Decimal('0.4'),
    xgFor: new Decimal('1.2'),
    xgAgainst: new Decimal('1.6'),
    homeWinRate: new Decimal('0.45'),
    awayWinRate: new Decimal('0.30'),
    drawRate: new Decimal('0.25'),
    leagueVolatility: new Decimal('1.4'),
    afterFixture: { scheduledAt: new Date('2022-12-31T12:00:00.000Z') },
  },
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
  } as unknown as BettingEngineService;
}

describe('BacktestService.runAllSeasons', () => {
  it('aggregates reports from all seasons in the DB', async () => {
    const prismaMock = {
      client: {
        season: {
          findMany: vi.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
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

    const service = new BacktestService(
      prismaMock,
      makeBettingMock(),
      notificationMock,
    );
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

    const service = new BacktestService(
      prismaMock,
      makeBettingMock(),
      notificationMock,
    );
    const report = await service.runAllSeasons();

    expect(report.seasons).toHaveLength(0);
    expect(report.totalFixtures).toBe(0);
    expect(report.totalAnalyzed).toBe(0);
    expect(report.averageBrierScore.toNumber()).toBe(0);
    expect(report.aggregateRoi.toNumber()).toBe(0);
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

    const service = new BacktestService(
      prismaMock,
      makeBettingMock(),
      notificationMock,
    );
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

    const service = new BacktestService(
      prismaMock,
      makeBettingMock(),
      notificationMock,
    );

    vi.spyOn(service, 'runAllSeasons').mockResolvedValue({
      seasons: [],
      totalFixtures: 100,
      totalAnalyzed: 100,
      averageBrierScore: new Decimal('0.20'),
      averageCalibrationError: new Decimal('0.03'),
      aggregateRoi: new Decimal('0.05'),
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

  it('returns FAIL when Brier Score exceeds threshold', async () => {
    const prismaMock = {
      client: {
        season: { findMany: vi.fn().mockResolvedValue([{ id: 's1' }]) },
        fixture: { findMany: vi.fn() },
        teamStats: { findMany: vi.fn() },
        oddsSnapshot: { findMany: vi.fn() },
      },
    } as unknown as PrismaService;

    const service = new BacktestService(
      prismaMock,
      makeBettingMock(),
      notificationMock,
    );

    vi.spyOn(service, 'runAllSeasons').mockResolvedValue({
      seasons: [],
      totalFixtures: 100,
      totalAnalyzed: 100,
      averageBrierScore: new Decimal('0.35'), // above 0.25 threshold → FAIL
      averageCalibrationError: new Decimal('0.03'),
      aggregateRoi: new Decimal('0.05'),
      reportGeneratedAt: new Date(),
    });

    const report = await service.getValidationReport();

    expect(report.overallVerdict).toBe('FAIL');
    expect(report.brierScore.verdict).toBe('FAIL');
    expect(report.calibrationError.verdict).toBe('PASS');
    expect(report.roi.verdict).toBe('PASS');
  });
});
