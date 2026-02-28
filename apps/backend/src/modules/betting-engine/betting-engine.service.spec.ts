import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
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
  it('calculates EV using decimal arithmetic', () => {
    const service = new BettingEngineService({} as PrismaService);
    const ev = service.calculateEV(new Decimal('0.54'), new Decimal('2.0'));
    expect(ev.toNumber()).toBeCloseTo(0.08, 8);
  });

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
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        marketSuspension: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        bet: {
          create: vi.fn(),
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
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        bet: {
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

  it('places a bet when deterministic score passes and EV is exactly threshold', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
    const createBet = vi.fn().mockResolvedValue({ id: 'bet-id' });
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
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              bookmaker: 'Pinnacle',
              snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
              homeOdds: new Decimal('2.16'),
              drawOdds: new Decimal('2.7'),
              awayOdds: new Decimal('5.4'),
            },
          ]),
        },
        marketSuspension: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        modelRun: {
          create: createModelRun,
        },
        bet: {
          create: createBet,
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(prismaMock);
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.5'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.2'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.8'),
        dcX2: new Decimal('0.5'),
        dc12: new Decimal('0.7'),
      },
      features: {
        recentForm: new Decimal('0.7'),
        xg: new Decimal('0.7'),
        domExtPerf: new Decimal('0.6'),
        leagueVolat: new Decimal('0.4'),
      },
    });

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.decision).toBe('BET');
    }

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'BET',
        }),
      }),
    );
    expect(createBet).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelRunId: 'run-id',
          market: Market.ONE_X_TWO,
          pick: 'HOME',
        }),
      }),
    );
  });

  it('keeps NO_BET when EV is below threshold', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
    const createBet = vi.fn().mockResolvedValue({ id: 'bet-id' });
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
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              bookmaker: 'Pinnacle',
              snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
              homeOdds: new Decimal('2.158'),
              drawOdds: new Decimal('2.2'),
              awayOdds: new Decimal('3.8'),
            },
          ]),
        },
        marketSuspension: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        modelRun: {
          create: createModelRun,
        },
        bet: {
          create: createBet,
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(prismaMock);
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.5'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.2'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.8'),
        dcX2: new Decimal('0.5'),
        dc12: new Decimal('0.7'),
      },
      features: {
        recentForm: new Decimal('0.7'),
        xg: new Decimal('0.7'),
        domExtPerf: new Decimal('0.6'),
        leagueVolat: new Decimal('0.4'),
      },
    });

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.decision).toBe('NO_BET');
    }

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'NO_BET',
        }),
      }),
    );
    expect(createBet).not.toHaveBeenCalled();
  });
});
