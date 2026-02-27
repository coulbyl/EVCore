import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BacktestService } from './backtest.service';
import type { PrismaService } from '@/prisma.service';
import type { BettingEngineService } from '@modules/betting-engine/betting-engine.service';

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

    const service = new BacktestService(prismaMock, bettingMock);
    const report = await service.runBacktest('s1');

    expect(report.seasonId).toBe('s1');
    expect(report.fixtureCount).toBe(2);
    expect(report.analyzedCount).toBe(1);
    expect(report.skippedCount).toBe(1);
    expect(report.brierScore.toNumber()).toBeCloseTo(0.24, 6);
    expect(report.calibrationError.toNumber()).toBeCloseTo(0.266666, 5);
    expect(report.roiSimulated.toNumber()).toBeCloseTo(1.1, 6);
  });
});
