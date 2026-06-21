/**
 * Characterization (golden) test for BettingEngineService.analyzeFixture.
 *
 * Purpose: lock the *current* deterministic decision output byte-for-byte so the
 * upcoming behavior-preserving refactor (extract odds loader / settlement / pick
 * engine) can be proven not to change any scoring. It runs the FULL pipeline —
 * real Poisson math, real pick evaluation — over fixed inputs and snapshots the
 * decision. It intentionally does NOT mock computeFromTeamStats.
 *
 * If a snapshot here changes during the refactor, the refactor changed behavior.
 * Update the snapshot ONLY when an intentional scoring change is made.
 */
import { describe, it, expect, vi } from 'vitest';
import Decimal from 'decimal.js';
import { BettingEngineService } from './betting-engine.service';
import type { PrismaService } from '@/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { H2HService } from './h2h.service';
import type { CongestionService } from './congestion.service';
import type { MlInferenceService } from '@modules/ml/ml.inference.service';

type OddsRow = {
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: Decimal;
  drawOdds: Decimal;
  awayOdds: Decimal;
};

function makeConfig(): ConfigService {
  return { get: vi.fn().mockReturnValue('false') } as unknown as ConfigService;
}

function makeDeps(): {
  h2h: H2HService;
  congestion: CongestionService;
  ml: MlInferenceService;
} {
  return {
    h2h: {
      computeH2HScore: vi.fn().mockResolvedValue(0.5),
    } as unknown as H2HService,
    congestion: {
      computeCongestionScore: vi.fn().mockResolvedValue(0.1),
    } as unknown as CongestionService,
    ml: {
      predictShadowCorrection: vi.fn().mockResolvedValue(null),
    } as unknown as MlInferenceService,
  };
}

// Deterministic, strong home side vs weak away side.
const HOME_STATS = {
  recentForm: new Decimal('0.7'),
  xgFor: new Decimal('1.9'),
  xgAgainst: new Decimal('0.9'),
  homeWinRate: new Decimal('0.65'),
  awayWinRate: new Decimal('0.35'),
  drawRate: new Decimal('0.20'),
  leagueVolatility: new Decimal('1.5'),
};
const AWAY_STATS = {
  recentForm: new Decimal('0.35'),
  xgFor: new Decimal('1.0'),
  xgAgainst: new Decimal('1.7'),
  homeWinRate: new Decimal('0.45'),
  awayWinRate: new Decimal('0.28'),
  drawRate: new Decimal('0.25'),
  leagueVolatility: new Decimal('1.4'),
};

function makePrisma(oddsRows: OddsRow[]): PrismaService {
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
          .mockResolvedValueOnce(HOME_STATS)
          .mockResolvedValueOnce(AWAY_STATS),
      },
      modelRun: { create: vi.fn().mockResolvedValue({ id: 'run-id' }) },
      nationalTeamEloRating: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      oddsSnapshot: {
        findMany: vi.fn().mockResolvedValue(oddsRows),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      marketSuspension: { findMany: vi.fn().mockResolvedValue([]) },
      adjustmentProposal: { findFirst: vi.fn().mockResolvedValue(null) },
      bet: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'bet-id' }),
        update: vi.fn().mockResolvedValue({ id: 'bet-id' }),
      },
    },
  } as unknown as PrismaService;
}

// Serialize the decision into a stable, JSON-friendly shape. Decimals → fixed
// strings so the snapshot is deterministic and readable.
function serialize(result: unknown): unknown {
  return JSON.parse(
    JSON.stringify(result, (_key, value: unknown) => {
      if (value instanceof Decimal) return value.toFixed(6);
      if (typeof value === 'number') return Number(value.toFixed(6));
      return value;
    }),
  );
}

function makeService(prisma: PrismaService): BettingEngineService {
  const { h2h, congestion, ml } = makeDeps();
  return new BettingEngineService(prisma, makeConfig(), h2h, congestion, ml);
}

describe('BettingEngineService golden — analyzeFixture decision output', () => {
  it('locks the decision for a strong-home fixture with generous home odds', async () => {
    const prisma = makePrisma([
      {
        bookmaker: 'Pinnacle',
        snapshotAt: new Date('2023-01-01T11:00:00.000Z'),
        homeOdds: new Decimal('2.20'),
        drawOdds: new Decimal('3.40'),
        awayOdds: new Decimal('3.60'),
      },
    ]);
    const result = await makeService(prisma).analyzeFixture('fixture-id');

    expect(serialize(result)).toMatchSnapshot();
  });

  it('locks the NO_BET decision when no market odds are available', async () => {
    const prisma = makePrisma([]);
    const result = await makeService(prisma).analyzeFixture('fixture-id');

    expect(serialize(result)).toMatchSnapshot();
  });
});
