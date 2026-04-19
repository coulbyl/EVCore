import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BetStatus, Market } from '@evcore/db';
import {
  poissonProba,
  calculateDeterministicScore,
  calculateKellyStakePct,
  deriveMarketsFromPoisson,
  buildPoissonDistributions,
  computeJointProbability,
  resolveComboPickBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  COMBO_WHITELIST,
} from './betting-engine.utils';
import {
  BettingEngineService,
  blendTeamStats,
  estimateComboOdds,
} from './betting-engine.service';
import type { PrismaService } from '@/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { H2HService } from './h2h.service';
import type { CongestionService } from './congestion.service';
import type { BankrollService } from '@modules/bankroll/bankroll.service';

function makeHtftProbabilities(defaultValue = '0.111111') {
  return {
    HOME_HOME: new Decimal(defaultValue),
    HOME_DRAW: new Decimal(defaultValue),
    HOME_AWAY: new Decimal(defaultValue),
    DRAW_HOME: new Decimal(defaultValue),
    DRAW_DRAW: new Decimal(defaultValue),
    DRAW_AWAY: new Decimal(defaultValue),
    AWAY_HOME: new Decimal(defaultValue),
    AWAY_DRAW: new Decimal(defaultValue),
    AWAY_AWAY: new Decimal(defaultValue),
  };
}

function makeConfig(kellyEnabled = false): ConfigService {
  return {
    get: vi.fn().mockReturnValue(kellyEnabled ? 'true' : 'false'),
  } as unknown as ConfigService;
}

function makeH2hServiceMock(score: number | null = null): H2HService {
  return {
    computeH2HScore: vi.fn().mockResolvedValue(score),
  } as unknown as H2HService;
}

function makeCongestionServiceMock(score = 0): CongestionService {
  return {
    computeCongestionScore: vi.fn().mockResolvedValue(score),
  } as unknown as CongestionService;
}

function makeBankrollServiceMock(): Pick<
  BankrollService,
  'recordBetWon' | 'recordBetVoid'
> {
  return {
    recordBetWon: vi.fn().mockResolvedValue(undefined),
    recordBetVoid: vi.fn().mockResolvedValue(undefined),
  };
}

// Minimal Prisma mock shared across analyzeFixture tests.
// Provides just enough responses for a NO_BET path (no odds → no bet).
function makePrismaMock(
  overrides: Record<string, unknown> = {},
): PrismaService {
  return {
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
      modelRun: { create: vi.fn().mockResolvedValue({ id: 'run-id' }) },
      nationalTeamEloRating: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      oddsSnapshot: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      marketSuspension: {
        // findMany returns [] = no active suspensions
        findMany: vi.fn().mockResolvedValue([]),
      },
      adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
      bet: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
      },
      ...overrides,
    },
  } as unknown as PrismaService;
}

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
    const derived = deriveMarketsFromPoisson({
      lambdaHome: 1.6,
      lambdaAway: 1.1,
      oneXTwo,
    });

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
    const htftSum = Object.values(derived.htft).reduce(
      (sum, p) => sum.plus(p),
      new Decimal(0),
    );
    expect(htftSum.toNumber()).toBeCloseTo(1, 6);
  });

  it('returns coherent totals ladders for 1.5, 2.5 and 3.5', () => {
    const oneXTwo = poissonProba(1.4, 1.0);
    const derived = deriveMarketsFromPoisson({
      lambdaHome: 1.4,
      lambdaAway: 1.0,
      oneXTwo,
    });

    expect(derived.over15.plus(derived.under15).toNumber()).toBeCloseTo(1, 6);
    expect(derived.over35.plus(derived.under35).toNumber()).toBeCloseTo(1, 6);
    expect(derived.over15.toNumber()).toBeGreaterThan(
      derived.over25.toNumber(),
    );
    expect(derived.over25.toNumber()).toBeGreaterThan(
      derived.over35.toNumber(),
    );
    expect(derived.under15.toNumber()).toBeLessThan(derived.under25.toNumber());
    expect(derived.under25.toNumber()).toBeLessThan(derived.under35.toNumber());
    expect(derived.over15.toNumber()).toBeCloseTo(0.69156, 5);
    expect(derived.over35.toNumber()).toBeCloseTo(0.22128, 5);
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

describe('calculateKellyStakePct', () => {
  const cfg = { fraction: 0.25, maxStake: 0.05 };

  it('returns 0 when odds are at or below 1', () => {
    expect(calculateKellyStakePct(0.6, 1.0, cfg).toNumber()).toBe(0);
  });

  it('returns 0 when Kelly is negative (no edge)', () => {
    expect(calculateKellyStakePct(0.4, 2.0, cfg).toNumber()).toBe(0);
  });

  it('computes fractional Kelly for known inputs', () => {
    expect(calculateKellyStakePct(0.55, 2.0, cfg).toNumber()).toBeCloseTo(
      0.025,
      6,
    );
  });

  it('caps stake at maxStake', () => {
    expect(calculateKellyStakePct(0.9, 3.0, cfg).toNumber()).toBe(0.05);
  });
});

describe('computeJointProbability', () => {
  it('HOME_WIN + BTTS_YES is lower than HOME_WIN alone and greater than 0', () => {
    const { distHome, distAway } = buildPoissonDistributions(1.5, 1.2);
    const joint = computeJointProbability(
      {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.BTTS,
        pick2: 'YES',
      },
      distHome,
      distAway,
    );
    const homeOnly = computeJointProbability(
      {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.ONE_X_TWO,
        pick2: 'HOME',
      },
      distHome,
      distAway,
    );
    expect(joint.toNumber()).toBeGreaterThan(0);
    expect(joint.toNumber()).toBeLessThan(homeOnly.toNumber());
  });
});

describe('settleOpenBets', () => {
  it('credits winning slips with the effective stake and odds snapshot', async () => {
    const bankroll = makeBankrollServiceMock();
    const tx = {
      bet: {
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const prismaMock = {
      client: {
        fixture: {
          findUnique: vi.fn().mockResolvedValue({
            homeScore: 2,
            awayScore: 1,
            homeHtScore: 1,
            awayHtScore: 0,
            status: 'FINISHED',
          }),
        },
        bet: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'bet-1',
              market: Market.ONE_X_TWO,
              pick: 'HOME',
              comboMarket: null,
              comboPick: null,
              oddsSnapshot: new Decimal('2.30'),
              betSlipItems: [
                {
                  userId: 'u1',
                  stakeOverride: new Decimal('12.50'),
                  betSlip: { unitStake: new Decimal('10.00') },
                },
                {
                  userId: 'u2',
                  stakeOverride: null,
                  betSlip: { unitStake: new Decimal('8.00') },
                },
              ],
            },
          ]),
          update: tx.bet.update,
        },
        $transaction: vi.fn().mockImplementation((callback) => callback(tx)),
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
      bankroll as BankrollService,
    );

    await expect(service.settleOpenBets('fixture-1')).resolves.toEqual({
      settled: 1,
    });

    expect(tx.bet.update).toHaveBeenCalledWith({
      where: { id: 'bet-1' },
      data: { status: BetStatus.WON },
    });
    expect(bankroll.recordBetWon).toHaveBeenCalledTimes(2);
    expect(bankroll.recordBetWon).toHaveBeenNthCalledWith(
      1,
      {
        userId: 'u1',
        betId: 'bet-1',
        stake: new Decimal('12.50'),
        odds: new Decimal('2.30'),
      },
      { tx },
    );
    expect(bankroll.recordBetWon).toHaveBeenNthCalledWith(
      2,
      {
        userId: 'u2',
        betId: 'bet-1',
        stake: new Decimal('8.00'),
        odds: new Decimal('2.30'),
      },
      { tx },
    );
  });
});

describe('COMBO_WHITELIST', () => {
  it('does not contain HOME+DRAW (impossible combo)', () => {
    const hasHomeDraw = COMBO_WHITELIST.some(
      (c) =>
        c.market1 === Market.ONE_X_TWO &&
        c.pick1 === 'HOME' &&
        c.market2 === Market.ONE_X_TWO &&
        c.pick2 === 'DRAW',
    );
    expect(hasHomeDraw).toBe(false);
  });

  it('does not contain AWAY+HOME (impossible combo)', () => {
    const hasAwayHome = COMBO_WHITELIST.some(
      (c) =>
        c.market1 === Market.ONE_X_TWO &&
        c.pick1 === 'AWAY' &&
        c.market2 === Market.ONE_X_TWO &&
        c.pick2 === 'HOME',
    );
    expect(hasAwayHome).toBe(false);
  });
});

describe('resolveComboPickBetStatus', () => {
  it('HOME + BTTS_YES with score 2-1 → WON', () => {
    const result = resolveComboPickBetStatus(
      {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.BTTS,
        pick2: 'YES',
      },
      2,
      1,
    );
    expect(result).toBe('WON');
  });

  it('HOME + BTTS_YES with score 1-0 → LOST (BTTS fails)', () => {
    const result = resolveComboPickBetStatus(
      {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.BTTS,
        pick2: 'YES',
      },
      1,
      0,
    );
    expect(result).toBe('LOST');
  });

  it('returns VOID when scores are null', () => {
    const result = resolveComboPickBetStatus(
      {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.BTTS,
        pick2: 'YES',
      },
      null,
      null,
    );
    expect(result).toBe('VOID');
  });
});

describe('resolveHalfTimeFullTimeBetStatus', () => {
  it('returns WON when both half-time and full-time outcomes match', () => {
    const result = resolveHalfTimeFullTimeBetStatus({
      pick: 'HOME_HOME',
      homeHtScore: 1,
      awayHtScore: 0,
      homeScore: 2,
      awayScore: 1,
    });
    expect(result).toBe('WON');
  });

  it('returns LOST when half-time/full-time pick does not match', () => {
    const result = resolveHalfTimeFullTimeBetStatus({
      pick: 'DRAW_HOME',
      homeHtScore: 1,
      awayHtScore: 0,
      homeScore: 2,
      awayScore: 1,
    });
    expect(result).toBe('LOST');
  });

  it('returns VOID when half-time scores are missing', () => {
    const result = resolveHalfTimeFullTimeBetStatus({
      pick: 'HOME_HOME',
      homeHtScore: null,
      awayHtScore: null,
      homeScore: 2,
      awayScore: 1,
    });
    expect(result).toBe('VOID');
  });
});

describe('BettingEngineService', () => {
  it('shortens combo odds when model joint probability exceeds independence', () => {
    const probabilities = {
      home: new Decimal('0.62'),
      draw: new Decimal('0.22'),
      away: new Decimal('0.16'),
      over15: new Decimal('0.70'),
      under15: new Decimal('0.30'),
      over25: new Decimal('0.48'),
      under25: new Decimal('0.52'),
      over35: new Decimal('0.26'),
      under35: new Decimal('0.74'),
      bttsYes: new Decimal('0.39'),
      bttsNo: new Decimal('0.61'),
      dc1X: new Decimal('0.84'),
      dcX2: new Decimal('0.38'),
      dc12: new Decimal('0.78'),
      htft: makeHtftProbabilities('0.01'),
      ouHT: {},
      firstHalfWinner: {
        home: new Decimal('0.33'),
        draw: new Decimal('0.34'),
        away: new Decimal('0.33'),
      },
    };
    const estimatedOdds = estimateComboOdds({
      combo: {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.BTTS,
        pick2: 'NO',
      },
      probabilities,
      jointProbability: new Decimal('0.44'),
      odds1: new Decimal('1.55'),
      odds2: new Decimal('2.18'),
    });

    expect(estimatedOdds.toNumber()).toBeLessThan(1.55 * 2.18);
    expect(estimatedOdds.toNumber()).toBeGreaterThan(2.7);
    expect(estimatedOdds.toNumber()).toBeLessThan(3.1);
  });

  it('extends combo odds when model joint probability is below independence', () => {
    const probabilities = {
      home: new Decimal('0.62'),
      draw: new Decimal('0.22'),
      away: new Decimal('0.16'),
      over15: new Decimal('0.70'),
      under15: new Decimal('0.30'),
      over25: new Decimal('0.48'),
      under25: new Decimal('0.52'),
      over35: new Decimal('0.26'),
      under35: new Decimal('0.74'),
      bttsYes: new Decimal('0.39'),
      bttsNo: new Decimal('0.61'),
      dc1X: new Decimal('0.84'),
      dcX2: new Decimal('0.38'),
      dc12: new Decimal('0.78'),
      htft: makeHtftProbabilities('0.01'),
      ouHT: {},
      firstHalfWinner: {
        home: new Decimal('0.33'),
        draw: new Decimal('0.34'),
        away: new Decimal('0.33'),
      },
    };
    const estimatedOdds = estimateComboOdds({
      combo: {
        market1: Market.ONE_X_TWO,
        pick1: 'HOME',
        market2: Market.BTTS,
        pick2: 'YES',
      },
      probabilities,
      jointProbability: new Decimal('0.20'),
      odds1: new Decimal('1.55'),
      odds2: new Decimal('1.63'),
    });

    expect(estimatedOdds.toNumber()).toBeGreaterThan(1.55 * 1.63);
    expect(estimatedOdds.toNumber()).toBeGreaterThan(2.7);
    expect(estimatedOdds.toNumber()).toBeLessThan(3.0);
  });

  it('calculates EV using decimal arithmetic', () => {
    const service = new BettingEngineService(
      {} as PrismaService,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    const ev = service.calculateEV(new Decimal('0.54'), new Decimal('2.0'));
    expect(ev.toNumber()).toBeCloseTo(0.08, 8);
  });

  it('computes 1X2 and derived probabilities together', () => {
    const service = new BettingEngineService(
      {} as PrismaService,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    const p = service.computeProbabilities(1.4, 1.1);

    expect(p.home.plus(p.draw).plus(p.away).toNumber()).toBeCloseTo(1, 3);
    expect(p.over25.plus(p.under25).toNumber()).toBeCloseTo(1, 6);
    expect(p.bttsYes.plus(p.bttsNo).toNumber()).toBeCloseTo(1, 6);
  });

  it('analyzes and persists a model run when fixture and team stats exist', async () => {
    const service = new BettingEngineService(
      makePrismaMock(),
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.modelRunId).toBe('run-id');
      const probabilities = result.probabilities as Record<string, number>;
      expect(
        probabilities.home + probabilities.draw + probabilities.away,
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
        modelRun: { create: vi.fn() },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    const result = await service.analyzeFixture('fixture-id');

    expect(result).toEqual({
      status: 'skipped',
      fixtureId: 'fixture-id',
      reason: 'missing_team_stats',
    });
  });

  it('analyzes FRI fixtures via de-vigged 1X2 odds even when team stats are missing', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
    const prismaMock = {
      client: {
        fixture: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'fixture-id',
            seasonId: 'season-id',
            scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
            homeTeamId: 'home-team',
            awayTeamId: 'away-team',
            status: 'SCHEDULED',
            homeTeam: { name: 'Armenia' },
            awayTeam: { name: 'Belarus' },
            season: { competition: { code: 'FRI' } },
          }),
        },
        teamStats: {
          findFirst: vi.fn(),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              bookmaker: 'Pinnacle',
              snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
              homeOdds: new Decimal('1.50'),
              drawOdds: new Decimal('4.20'),
              awayOdds: new Decimal('7.50'),
            },
            {
              bookmaker: 'Bet365',
              snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
              homeOdds: new Decimal('1.95'),
              drawOdds: new Decimal('4.50'),
              awayOdds: new Decimal('8.20'),
            },
          ]),
          findFirst: vi.fn().mockResolvedValueOnce({
            bookmaker: 'Pinnacle',
            snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
            homeOdds: new Decimal('1.50'),
            drawOdds: new Decimal('4.20'),
            awayOdds: new Decimal('7.50'),
          }),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
        nationalTeamEloRating: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.modelRunId).toBe('run-id');
      expect(result.decision).toBe('BET');
      expect(result.valueBet).toMatchObject({
        market: Market.ONE_X_TWO,
        pick: 'HOME',
      });
    }

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'BET',
          features: expect.objectContaining({
            predictionSource: 'ODDS_DEVIG',
            fallbackReason: null,
            lambdaHome: null,
            lambdaAway: null,
            offeredBookmakers: {
              home: 'Bet365',
              draw: 'Bet365',
              away: 'Bet365',
            },
            candidatePicks: expect.arrayContaining([
              expect.objectContaining({
                market: Market.ONE_X_TWO,
                pick: 'HOME',
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it('uses real Elo as the primary FRI fallback for mapped senior teams', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
    const prismaMock = {
      client: {
        fixture: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'fixture-id',
            seasonId: 'season-id',
            scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
            homeTeamId: 'home-team',
            awayTeamId: 'away-team',
            status: 'SCHEDULED',
            homeTeam: { name: 'Germany' },
            awayTeam: { name: 'Ghana' },
            season: { competition: { code: 'FRI' } },
          }),
        },
        teamStats: {
          findFirst: vi.fn(),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              bookmaker: 'Bet365',
              snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
              homeOdds: new Decimal('1.62'),
              drawOdds: new Decimal('4.30'),
              awayOdds: new Decimal('8.50'),
            },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
        nationalTeamEloRating: {
          findFirst: vi.fn().mockResolvedValue({
            snapshotAt: new Date('2023-01-01T00:00:00.000Z'),
          }),
          findMany: vi.fn().mockResolvedValue([
            { teamName: 'Germany', rating: 1922 },
            { teamName: 'Ghana', rating: 1725 },
          ]),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.decision).toBe('BET');
      expect(result.valueBet).toMatchObject({
        market: Market.ONE_X_TWO,
        pick: 'HOME',
      });
    }

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'BET',
          features: expect.objectContaining({
            predictionSource: 'FRI_ELO_REAL',
            fallbackReason: null,
            eloHome: expect.any(Number),
            eloAway: expect.any(Number),
          }),
        }),
      }),
    );
  });

  it('creates a NO_BET model run for FRI fixtures when 1X2 odds are missing', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
    const prismaMock = {
      client: {
        fixture: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'fixture-id',
            seasonId: 'season-id',
            scheduledAt: new Date('2023-01-01T12:00:00.000Z'),
            homeTeamId: 'home-team',
            awayTeamId: 'away-team',
            status: 'SCHEDULED',
            homeTeam: { name: 'Armenia' },
            awayTeam: { name: 'Belarus' },
            season: { competition: { code: 'FRI' } },
          }),
        },
        teamStats: {
          findFirst: vi.fn(),
        },
        oddsSnapshot: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
        nationalTeamEloRating: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    const result = await service.analyzeFixture('fixture-id');

    expect(result).toMatchObject({
      status: 'analyzed',
      fixtureId: 'fixture-id',
      decision: 'NO_BET',
      modelRunId: 'run-id',
      valueBet: null,
    });

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'NO_BET',
          features: expect.objectContaining({
            predictionSource: null,
            fallbackReason: 'missing_market_odds',
            candidatePicks: [],
            evaluatedPicks: [],
          }),
        }),
      }),
    );
  });

  it('places a bet when deterministic score and quality score both pass', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
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
              homeOdds: new Decimal('2.20'),
              drawOdds: new Decimal('2.7'),
              awayOdds: new Decimal('5.4'),
            },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
      },
    } as unknown as PrismaService;

    const h2hService = makeH2hServiceMock(0.6);
    const congestionService = makeCongestionServiceMock(0.2);
    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      h2hService,
      congestionService,
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.5'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.2'),
        over15: new Decimal('0.7'),
        under15: new Decimal('0.3'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        over35: new Decimal('0.2'),
        under35: new Decimal('0.8'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.8'),
        dcX2: new Decimal('0.5'),
        dc12: new Decimal('0.7'),
        htft: makeHtftProbabilities(),
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
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
      expect(result.valueBet).toMatchObject({
        modelRunId: 'run-id',
        market: Market.ONE_X_TWO,
        pick: 'HOME',
      });
    }

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          decision: 'BET',
          features: expect.objectContaining({
            shadow_h2h: 0.6,
            shadow_congestion: 0.2,
            candidatePicks: expect.arrayContaining([
              expect.objectContaining({
                market: Market.ONE_X_TWO,
                pick: 'HOME',
                probability: 0.5,
              }),
            ]),
            evaluatedPicks: expect.arrayContaining([
              expect.objectContaining({
                market: Market.ONE_X_TWO,
                pick: 'HOME',
                status: 'viable',
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it('keeps NO_BET when EV is below threshold', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
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
              homeOdds: new Decimal('2.158'), // EV = (0.5 × 2.158) - 1 = 0.079 < 0.08
              drawOdds: new Decimal('2.2'), // EV = (0.3 × 2.2) - 1 = -0.34 < 0.08
              awayOdds: new Decimal('3.8'), // EV = (0.2 × 3.8) - 1 = -0.24 < 0.08
            },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.5'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.2'),
        over15: new Decimal('0.7'),
        under15: new Decimal('0.3'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        over35: new Decimal('0.2'),
        under35: new Decimal('0.8'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.8'),
        dcX2: new Decimal('0.5'),
        dc12: new Decimal('0.7'),
        htft: makeHtftProbabilities(),
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
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
      expect(result.valueBet).toBeNull();
    }

    expect(createModelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: 'NO_BET' }),
      }),
    );
  });

  it('rejects 1X2 AWAY picks above MAX_SELECTION_ODDS cap', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
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
              homeOdds: new Decimal('1.9'),
              drawOdds: new Decimal('3.6'),
              awayOdds: new Decimal('8.5'), // above MAX_SELECTION_ODDS=4.0
            },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.0, away: 1.7 },
      probabilities: {
        home: new Decimal('0.18'),
        draw: new Decimal('0.17'),
        away: new Decimal('0.65'),
        over15: new Decimal('0.78'),
        under15: new Decimal('0.22'),
        over25: new Decimal('0.52'),
        under25: new Decimal('0.48'),
        over35: new Decimal('0.29'),
        under35: new Decimal('0.71'),
        bttsYes: new Decimal('0.49'),
        bttsNo: new Decimal('0.51'),
        dc1X: new Decimal('0.35'),
        dcX2: new Decimal('0.82'),
        dc12: new Decimal('0.83'),
        htft: makeHtftProbabilities('0.111111'),
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
      },
      features: {
        recentForm: new Decimal('0.3'),
        xg: new Decimal('0.35'),
        domExtPerf: new Decimal('0.3'),
        leagueVolat: new Decimal('0.3'),
      },
    });

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.decision).toBe('NO_BET');
      expect(result.valueBet).toBeNull();
    }
  });

  it('rejects 1X2 DRAW picks above MAX_SELECTION_ODDS cap', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
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
              homeOdds: new Decimal('1.9'),
              drawOdds: new Decimal('7.2'), // above MAX_SELECTION_ODDS=4.0
              awayOdds: new Decimal('2.2'),
            },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.2, away: 1.2 },
      probabilities: {
        home: new Decimal('0.22'),
        draw: new Decimal('0.34'),
        away: new Decimal('0.44'),
        over15: new Decimal('0.72'),
        under15: new Decimal('0.28'),
        over25: new Decimal('0.44'),
        under25: new Decimal('0.56'),
        over35: new Decimal('0.21'),
        under35: new Decimal('0.79'),
        bttsYes: new Decimal('0.47'),
        bttsNo: new Decimal('0.53'),
        dc1X: new Decimal('0.60'),
        dcX2: new Decimal('0.74'),
        dc12: new Decimal('0.66'),
        htft: makeHtftProbabilities('0.111111'),
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
      },
      features: {
        recentForm: new Decimal('0.3'),
        xg: new Decimal('0.35'),
        domExtPerf: new Decimal('0.3'),
        leagueVolat: new Decimal('0.3'),
      },
    });

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    if (result.status === 'analyzed') {
      expect(result.decision).toBe('NO_BET');
      expect(result.valueBet).toBeNull();
    }
  });

  it('selectBestViablePickForBacktest returns null when all picks exceed MAX_SELECTION_ODDS', () => {
    const service = new BettingEngineService(
      {} as unknown as PrismaService,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    const htft = makeHtftProbabilities('0.111111');
    const { distHome, distAway } = buildPoissonDistributions(1.2, 1.0);

    const result = service.selectBestViablePickForBacktest({
      probabilities: {
        home: new Decimal('0.20'),
        draw: new Decimal('0.25'),
        away: new Decimal('0.55'),
        over15: new Decimal('0.74'),
        under15: new Decimal('0.26'),
        over25: new Decimal('0.45'),
        under25: new Decimal('0.55'),
        over35: new Decimal('0.22'),
        under35: new Decimal('0.78'),
        bttsYes: new Decimal('0.47'),
        bttsNo: new Decimal('0.53'),
        dc1X: new Decimal('0.45'),
        dcX2: new Decimal('0.80'),
        dc12: new Decimal('0.75'),
        htft,
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
      },
      odds: {
        bookmaker: 'Pinnacle',
        snapshotAt: new Date(),
        homeOdds: new Decimal('6.5'), // all above cap=4.0
        drawOdds: new Decimal('5.2'),
        awayOdds: new Decimal('4.5'),
        overUnderOdds: {},
        bttsYesOdds: null,
        bttsNoOdds: null,
        htftOdds: {},
        ouHtOdds: {},
        firstHalfWinnerOdds: null,
      },
      deterministicScore: new Decimal('0.75'),
      distHome,
      distAway,
      lambdaFloorHit: false,
    });

    expect(result).toBeNull();
  });

  it('selectBestViablePickForBacktest returns null when all picks are below MIN_SELECTION_ODDS', () => {
    const service = new BettingEngineService(
      {} as unknown as PrismaService,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    const htft = makeHtftProbabilities('0.111111');
    const { distHome, distAway } = buildPoissonDistributions(2.0, 0.5);

    const result = service.selectBestViablePickForBacktest({
      probabilities: {
        home: new Decimal('0.75'),
        draw: new Decimal('0.15'),
        away: new Decimal('0.10'),
        over15: new Decimal('0.80'),
        under15: new Decimal('0.20'),
        over25: new Decimal('0.55'),
        under25: new Decimal('0.45'),
        over35: new Decimal('0.31'),
        under35: new Decimal('0.69'),
        bttsYes: new Decimal('0.40'),
        bttsNo: new Decimal('0.60'),
        dc1X: new Decimal('0.90'),
        dcX2: new Decimal('0.25'),
        dc12: new Decimal('0.85'),
        htft,
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
      },
      odds: {
        bookmaker: 'Pinnacle',
        snapshotAt: new Date(),
        homeOdds: new Decimal('1.30'), // below MIN_SELECTION_ODDS=1.80
        drawOdds: new Decimal('1.50'), // below MIN_SELECTION_ODDS=1.80
        awayOdds: new Decimal('1.60'), // below MIN_SELECTION_ODDS=1.80
        overUnderOdds: {},
        bttsYesOdds: null,
        bttsNoOdds: null,
        htftOdds: {},
        ouHtOdds: {},
        firstHalfWinnerOdds: null,
      },
      deterministicScore: new Decimal('0.80'),
      distHome,
      distAway,
      lambdaFloorHit: false,
    });

    expect(result).toBeNull();
  });

  it('selectBestViablePickForBacktest rejects Championship 1X2 HOME picks below 5.00', () => {
    const service = new BettingEngineService(
      {} as unknown as PrismaService,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    const htft = makeHtftProbabilities('0.111111');
    const { distHome, distAway } = buildPoissonDistributions(2.0, 0.5);

    const result = service.selectBestViablePickForBacktest({
      probabilities: {
        home: new Decimal('0.48'),
        draw: new Decimal('0.32'),
        away: new Decimal('0.20'),
        over15: new Decimal('0.80'),
        under15: new Decimal('0.20'),
        over25: new Decimal('0.55'),
        under25: new Decimal('0.45'),
        over35: new Decimal('0.31'),
        under35: new Decimal('0.69'),
        bttsYes: new Decimal('0.40'),
        bttsNo: new Decimal('0.60'),
        dc1X: new Decimal('0.80'),
        dcX2: new Decimal('0.45'),
        dc12: new Decimal('0.75'),
        htft,
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
      },
      odds: {
        bookmaker: 'Pinnacle',
        snapshotAt: new Date(),
        homeOdds: new Decimal('4.80'),
        drawOdds: new Decimal('3.50'),
        awayOdds: new Decimal('4.00'),
        overUnderOdds: {},
        bttsYesOdds: null,
        bttsNoOdds: new Decimal('2.30'),
        htftOdds: {},
        ouHtOdds: {},
        firstHalfWinnerOdds: null,
      },
      deterministicScore: new Decimal('0.80'),
      distHome,
      distAway,
      lambdaFloorHit: false,
      competitionCode: 'CH',
    });

    expect(result).not.toBeNull();
    expect(result?.pick).not.toBe('HOME');
  });

  it('uses Kelly stake size instead of flat stake when KELLY_ENABLED=true', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
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
              homeOdds: new Decimal('2.20'),
              drawOdds: new Decimal('2.7'),
              awayOdds: new Decimal('5.4'),
            },
          ]),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(true),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.5'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.2'),
        over15: new Decimal('0.7'),
        under15: new Decimal('0.3'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        over35: new Decimal('0.2'),
        under35: new Decimal('0.8'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.8'),
        dcX2: new Decimal('0.5'),
        dc12: new Decimal('0.7'),
        htft: makeHtftProbabilities(),
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
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
      expect(result.valueBet).not.toBeNull();
      expect(result.valueBet?.stakePct.toNumber()).toBeCloseTo(0.0208, 3);
      expect(result.valueBet?.stakePct.toNumber()).not.toBeCloseTo(0.01, 4);
    }
  });

  it('can select HALF_TIME_FULL_TIME when it has the best viable EV', async () => {
    const createModelRun = vi.fn().mockResolvedValue({ id: 'run-id' });
    const snapshotAt = new Date('2023-01-01T11:00:00.000Z');

    const oddsSnapshotFindMany = vi.fn().mockImplementation((args: unknown) => {
      const market = (args as { where?: { market?: Market } }).where?.market;
      if (market === Market.ONE_X_TWO) {
        return Promise.resolve([
          {
            bookmaker: 'Pinnacle',
            snapshotAt,
            homeOdds: new Decimal('1.20'),
            drawOdds: new Decimal('1.20'),
            awayOdds: new Decimal('1.20'),
          },
        ]);
      }
      if (market === Market.HALF_TIME_FULL_TIME) {
        return Promise.resolve([
          {
            bookmaker: 'Pinnacle',
            snapshotAt,
            pick: 'HOME_HOME',
            odds: new Decimal('2.00'),
          },
        ]);
      }
      return Promise.resolve([]);
    });

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
          findMany: oddsSnapshotFindMany,
          findFirst: vi.fn().mockResolvedValue(null),
        },
        marketSuspension: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
        modelRun: { create: createModelRun },
        bet: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        },
      },
    } as unknown as PrismaService;

    const service = new BettingEngineService(
      prismaMock,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );

    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue({
      deterministicScore: new Decimal('0.7'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal('0.3'),
        draw: new Decimal('0.3'),
        away: new Decimal('0.4'),
        over15: new Decimal('0.7'),
        under15: new Decimal('0.3'),
        over25: new Decimal('0.4'),
        under25: new Decimal('0.6'),
        over35: new Decimal('0.2'),
        under35: new Decimal('0.8'),
        bttsYes: new Decimal('0.5'),
        bttsNo: new Decimal('0.5'),
        dc1X: new Decimal('0.6'),
        dcX2: new Decimal('0.7'),
        dc12: new Decimal('0.7'),
        htft: {
          ...makeHtftProbabilities('0.01'),
          HOME_HOME: new Decimal('0.65'),
        },
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
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
      expect(result.valueBet).toMatchObject({
        market: Market.HALF_TIME_FULL_TIME,
        pick: 'HOME_HOME',
      });
    }
  });

  // ─── Safe value selection ──────────────────────────────────────────────────

  function makeSafeValuePrismaMock(homeOdds: string, overOdds: string | null) {
    const snapshotAt = new Date('2023-01-01T11:00:00.000Z');
    const betCreate = vi.fn().mockResolvedValue({ id: 'bet-id' });

    const oddsSnapshotFindMany = vi.fn().mockImplementation((args: unknown) => {
      const market = (args as { where?: { market?: Market } }).where?.market;
      if (market === Market.ONE_X_TWO) {
        return Promise.resolve([
          {
            bookmaker: 'Pinnacle',
            snapshotAt,
            homeOdds: new Decimal(homeOdds),
            drawOdds: new Decimal('3.50'),
            awayOdds: new Decimal('5.00'),
          },
        ]);
      }
      if (market === Market.OVER_UNDER && overOdds !== null) {
        return Promise.resolve([
          {
            bookmaker: 'Pinnacle',
            snapshotAt,
            pick: 'OVER',
            odds: new Decimal(overOdds),
          },
        ]);
      }
      return Promise.resolve([]);
    });

    return {
      betCreate,
      prisma: {
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
          modelRun: { create: vi.fn().mockResolvedValue({ id: 'run-id' }) },
          nationalTeamEloRating: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
          },
          oddsSnapshot: {
            findMany: oddsSnapshotFindMany,
            findFirst: vi.fn().mockResolvedValue(null),
          },
          marketSuspension: { findMany: vi.fn().mockResolvedValue([]) },
          adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
          bet: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: betCreate,
            update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
          },
        },
      } as unknown as PrismaService,
    };
  }

  function makeSafeValueProbabilities(homeProb: string) {
    return {
      deterministicScore: new Decimal('0.70'),
      lambda: { home: 1.4, away: 1.1 },
      probabilities: {
        home: new Decimal(homeProb),
        draw: new Decimal('0.14'),
        away: new Decimal('0.14'),
        over15: new Decimal('0.75'),
        under15: new Decimal('0.25'),
        over25: new Decimal('0.45'),
        under25: new Decimal('0.55'),
        over35: new Decimal('0.22'),
        under35: new Decimal('0.78'),
        bttsYes: new Decimal('0.42'),
        bttsNo: new Decimal('0.58'),
        dc1X: new Decimal('0.86'),
        dcX2: new Decimal('0.28'),
        dc12: new Decimal('0.86'),
        htft: makeHtftProbabilities('0.111111'),
        ouHT: {},
        firstHalfWinner: {
          home: new Decimal('0.33'),
          draw: new Decimal('0.34'),
          away: new Decimal('0.33'),
        },
      },
      features: {
        recentForm: new Decimal('0.7'),
        xg: new Decimal('0.7'),
        domExtPerf: new Decimal('0.6'),
        leagueVolat: new Decimal('0.4'),
      },
    };
  }

  it('saves a safe value bet for a qualifying pick distinct from the EV pick', async () => {
    // EV pick: OVER (odds=3.0, EV=0.35, quality=0.245)
    // Safe value: HOME (P=0.72 ≥ 0.68, odds=1.65 ∈ [1.15,2.20], EV=0.188)
    //   HOME is rejected by the EV system (odds=1.65 < 2.00 selection floor)
    //   but qualifies for safe value which targets high-P low-odds picks
    const { betCreate, prisma } = makeSafeValuePrismaMock('1.65', '3.0');
    const service = new BettingEngineService(
      prisma,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue(
      makeSafeValueProbabilities('0.72'),
    );

    const result = await service.analyzeFixture('fixture-id');

    expect(result.status).toBe('analyzed');
    expect(betCreate).toHaveBeenCalledTimes(2);

    const svArgs = (
      betCreate.mock.calls as [
        [unknown],
        [
          {
            data: {
              isSafeValue: boolean;
              market: Market;
              pick: string;
              pickKey: string;
            };
          },
        ],
      ]
    )[1][0];

    expect(svArgs.data.isSafeValue).toBe(true);
    expect(svArgs.data.market).toBe(Market.ONE_X_TWO);
    expect(svArgs.data.pick).toBe('HOME');
    expect(svArgs.data.pickKey).toMatch(/^sv:/);
  });

  it('skips safe value bet when no pick meets the probability threshold (P < 0.68)', async () => {
    // HOME has P=0.60 < 0.68 — below SAFE_VALUE_MIN_PROBABILITY
    // OVER has odds=3.0 > 2.20 — above SAFE_VALUE_MAX_ODDS
    // Neither qualifies for safe value
    const { betCreate, prisma } = makeSafeValuePrismaMock('2.10', '3.0');
    const service = new BettingEngineService(
      prisma,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue(
      makeSafeValueProbabilities('0.60'),
    );

    await service.analyzeFixture('fixture-id');

    // Only the EV bet create, no safe value create
    expect(betCreate).toHaveBeenCalledTimes(1);
    const evArgs = (
      betCreate.mock.calls as [{ data: { isSafeValue?: boolean } }[]]
    )[0][0];
    expect(evArgs.data.isSafeValue).toBeFalsy();
  });

  it('does not save a safe value bet when the only qualifying pick is the EV pick itself', async () => {
    // HOME: P=0.75, odds=2.10 (in safe range [1.15,2.20] AND above EV floor 2.00)
    // HOME wins as EV pick → evPickKey = ONE_X_TWO|HOME|-|-
    // selectSafeValuePick excludes HOME via evPickKey → returns null
    const { betCreate, prisma } = makeSafeValuePrismaMock('2.10', null);
    const service = new BettingEngineService(
      prisma,
      makeConfig(),
      makeH2hServiceMock(),
      makeCongestionServiceMock(),
    );
    vi.spyOn(service, 'computeFromTeamStats').mockReturnValue(
      makeSafeValueProbabilities('0.75'),
    );

    await service.analyzeFixture('fixture-id');

    expect(betCreate).toHaveBeenCalledTimes(1);
    const evArgs = (
      betCreate.mock.calls as [{ data: { isSafeValue?: boolean } }[]]
    )[0][0];
    expect(evArgs.data.isSafeValue).toBeFalsy();
  });
});

describe('blendTeamStats', () => {
  const euro = {
    recentForm: 0.8,
    xgFor: 2.0,
    xgAgainst: 0.8,
    homeWinRate: 0.6,
    awayWinRate: 0.4,
    drawRate: 0.2,
    leagueVolatility: 0.5,
  };
  const domestic = {
    recentForm: 0.6,
    xgFor: 1.4,
    xgAgainst: 1.2,
    homeWinRate: 0.55,
    awayWinRate: 0.35,
    drawRate: 0.25,
    leagueVolatility: 0.3,
  };

  it('blends recentForm with specified form weight', () => {
    const result = blendTeamStats({
      primary: euro,
      secondary: domestic,
      formWeight: 0.6,
      xgWeight: 0.4,
    });
    // 0.8 * 0.6 + 0.6 * 0.4 = 0.48 + 0.24 = 0.72
    expect(Number(result.recentForm)).toBeCloseTo(0.72, 6);
  });

  it('blends xgFor with specified xg weight', () => {
    const result = blendTeamStats({
      primary: euro,
      secondary: domestic,
      formWeight: 0.6,
      xgWeight: 0.4,
    });
    // 2.0 * 0.4 + 1.4 * 0.6 = 0.80 + 0.84 = 1.64
    expect(Number(result.xgFor)).toBeCloseTo(1.64, 6);
  });

  it('takes homeWinRate, awayWinRate, drawRate from secondary (domestic)', () => {
    const result = blendTeamStats({
      primary: euro,
      secondary: domestic,
      formWeight: 0.6,
      xgWeight: 0.4,
    });
    expect(result.homeWinRate).toBe(domestic.homeWinRate);
    expect(result.awayWinRate).toBe(domestic.awayWinRate);
    expect(result.drawRate).toBe(domestic.drawRate);
  });

  it('takes leagueVolatility from primary (European)', () => {
    const result = blendTeamStats({
      primary: euro,
      secondary: domestic,
      formWeight: 0.6,
      xgWeight: 0.4,
    });
    expect(result.leagueVolatility).toBe(euro.leagueVolatility);
  });

  it('works correctly with Decimal.js values (Prisma output)', () => {
    const euroDecimal = { ...euro, recentForm: new Decimal(0.8) };
    const result = blendTeamStats({
      primary: euroDecimal,
      secondary: domestic,
      formWeight: 0.6,
      xgWeight: 0.4,
    });
    expect(Number(result.recentForm)).toBeCloseTo(0.72, 6);
  });
});
