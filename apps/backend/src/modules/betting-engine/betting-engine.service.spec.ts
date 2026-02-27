import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  poissonProba,
  calculateDeterministicScore,
  deriveMarketsFromPoisson,
} from './betting-engine.utils';
import { BettingEngineService } from './betting-engine.service';
import type { PrismaService } from '@/prisma.service';

describe('poissonProba', () => {
  it('returns probabilities that sum close to 1', () => {
    const { home, draw, away } = poissonProba(1.5, 1.2);
    const sum = home.plus(draw).plus(away);
    expect(sum.toDecimalPlaces(4).toNumber()).toBeCloseTo(1, 3);
  });

  it('favors the side with higher expected goals', () => {
    const { home } = poissonProba(2.0, 0.8);
    expect(home.toNumber()).toBeGreaterThan(0.5);
  });
});

describe('deriveMarketsFromPoisson', () => {
  it('returns coherent derived market probabilities', () => {
    const oneXTwo = poissonProba(1.6, 1.1);
    const derived = deriveMarketsFromPoisson(1.6, 1.1, oneXTwo);

    expect(derived.over25.plus(derived.under25).toNumber()).toBeCloseTo(1, 6);
    expect(derived.bttsYes.plus(derived.bttsNo).toNumber()).toBeCloseTo(1, 6);
    expect(derived.dc1X.toNumber()).toBeCloseTo(
      oneXTwo.home.plus(oneXTwo.draw).toNumber(),
      8,
    );
    expect(derived.dcX2.toNumber()).toBeCloseTo(
      oneXTwo.draw.plus(oneXTwo.away).toNumber(),
      8,
    );
  });
});

describe('calculateDeterministicScore', () => {
  it('calculates weighted score for known inputs', () => {
    const score = calculateDeterministicScore({
      recentForm: new Decimal('0.8'),
      xg: new Decimal('0.7'),
      domExtPerf: new Decimal('0.6'),
      leagueVolat: new Decimal('0.4'),
    });

    expect(score.toNumber()).toBeCloseTo(0.66, 4);
  });
});

describe('BettingEngineService', () => {
  it('computes 1X2 and derived probabilities together', () => {
    const service = new BettingEngineService({} as PrismaService);
    const p = service.computeProbabilities(1.4, 1.1);

    expect(p.home.plus(p.draw).plus(p.away).toNumber()).toBeCloseTo(1, 3);
    expect(p.over25.plus(p.under25).toNumber()).toBeCloseTo(1, 6);
    expect(p.bttsYes.plus(p.bttsNo).toNumber()).toBeCloseTo(1, 6);
  });

  it('analyzes and persists a model run when fixture and team stats exist', async () => {
    const prismaMock = {
      client: {
        fixture: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'fixture-id',
            seasonId: 'season-id',
            scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
            homeTeamId: 'home-team',
            awayTeamId: 'away-team',
            status: 'FINISHED',
          }),
          findMany: vi.fn(),
        },
        teamStats: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({
              recentForm: new Decimal('0.7'),
              xgFor: new Decimal('1.8'),
              xgAgainst: new Decimal('1.1'),
              homeWinRate: new Decimal('0.65'),
              awayWinRate: new Decimal('0.35'),
              drawRate: new Decimal('0.20'),
              leagueVolatility: new Decimal('1.5'),
            })
            .mockResolvedValueOnce({
              recentForm: new Decimal('0.4'),
              xgFor: new Decimal('1.2'),
              xgAgainst: new Decimal('1.6'),
              homeWinRate: new Decimal('0.45'),
              awayWinRate: new Decimal('0.30'),
              drawRate: new Decimal('0.25'),
              leagueVolatility: new Decimal('1.4'),
            }),
        },
        modelRun: {
          create: vi.fn().mockResolvedValue({ id: 'run-id' }),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(prismaMock);
    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.modelRunId).toBe('run-id');
      expect(
        result.probabilities.home +
          result.probabilities.draw +
          result.probabilities.away,
      ).toBeCloseTo(1, 3);
    }
  });

  it('skips analysis when team stats are missing', async () => {
    const prismaMock = {
      client: {
        fixture: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'fixture-id',
            seasonId: 'season-id',
            scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
            homeTeamId: 'home-team',
            awayTeamId: 'away-team',
            status: 'FINISHED',
          }),
        },
        teamStats: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null),
        },
        modelRun: {
          create: vi.fn(),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(prismaMock);
    const result = await service.analyzeFixture('fixture-id');

    expect(result).toEqual({
      status: 'skipped',
      fixtureId: 'fixture-id',
      reason: 'missing_team_stats',
    });
  });
});
