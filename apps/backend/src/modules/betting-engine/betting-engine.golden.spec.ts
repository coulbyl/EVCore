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
import type { H2HService } from './h2h.service';
import type { CongestionService } from './congestion.service';
import type { MlInferenceService } from '@modules/ml/ml.inference.service';
import type { ChannelDecisionService } from './channel-decision.service';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type StrategyContext,
} from './channel-strategy.types';
import { buildBetPickKey } from './betting-engine.utils';
import { selectSafeValuePick } from './selection/pick-evaluation';
import type { EvaluatedPick, ViablePick } from './betting-engine.types';

type OddsRow = {
  bookmaker: string;
  snapshotAt: Date;
  homeOdds: Decimal;
  drawOdds: Decimal;
  awayOdds: Decimal;
};

function makeDeps(): {
  h2h: H2HService;
  congestion: CongestionService;
  ml: MlInferenceService;
} {
  return {
    h2h: {
      computeH2HScore: vi.fn().mockResolvedValue(0.5),
      computeH2HMarketSignals: vi.fn().mockResolvedValue({
        btts: null,
        over25: null,
        cleanSheetHome: null,
        cleanSheetAway: null,
        winToNilHome: null,
        winToNilAway: null,
        sampleSize: 0,
      }),
      computeH2HScorelineSignal: vi.fn().mockResolvedValue({
        scoreline: null,
        confidence: null,
        sampleSize: 0,
      }),
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
        count: vi.fn().mockResolvedValue(10),
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

// Same role as its twin in betting-engine.service.spec.ts: stands in for the
// real ChannelDecisionService, reproducing the pre-Phase-2 VALUE/SAFE pick
// selection directly from evaluatedMarkets so this golden test's snapshot
// stays anchored to the real decision-selection algorithm, not to whichever
// per-league Phase 1 specialist gates happen to apply to a synthetic fixture.
function makeChannelDecisionServiceMock(): ChannelDecisionService {
  let nextId = 0;
  const recordRunDecisions = vi.fn(
    (_modelRunId: string, context: StrategyContext) => {
      const evaluatedPicks: EvaluatedPick[] = context.evaluatedMarkets.flatMap(
        (m) => m.picks,
      );
      const viable = evaluatedPicks.filter(
        (p): p is ViablePick => p.rejectionReason === undefined,
      );
      const valuePick = viable[0] ?? null;

      const decisions: Array<{
        channel: (typeof STRATEGY_CHANNEL)[keyof typeof STRATEGY_CHANNEL];
        status: typeof CHANNEL_DECISION_STATUS.SELECTED;
        selections: [ViablePick];
      }> = [];
      if (valuePick !== null) {
        decisions.push({
          channel: STRATEGY_CHANNEL.VALUE,
          status: CHANNEL_DECISION_STATUS.SELECTED,
          selections: [valuePick],
        });
      }

      const evPickKey =
        valuePick !== null
          ? buildBetPickKey({ market: valuePick.market, pick: valuePick.pick })
          : null;
      const safePick = selectSafeValuePick(
        evaluatedPicks,
        context.signals.suspendedMarkets,
        evPickKey,
        context.signals.lambdaTotal,
        context.selectionConfig,
      );
      if (safePick !== null) {
        decisions.push({
          channel: STRATEGY_CHANNEL.SAFE,
          status: CHANNEL_DECISION_STATUS.SELECTED,
          selections: [safePick],
        });
      }

      return Promise.resolve(
        decisions.map((d) => ({
          id: `decision-${nextId++}`,
          channel: d.channel,
          status: d.status,
          selections: d.selections.map((selection) => ({
            market: selection.market,
            pick: selection.pick,
            probability: selection.probability,
            odds: selection.odds,
            ev: selection.ev,
            qualityScore: selection.qualityScore,
            rank: 1,
            id: `selection-${nextId++}`,
          })),
        })),
      );
    },
  );
  return { recordRunDecisions } as unknown as ChannelDecisionService;
}

function makeService(prisma: PrismaService): BettingEngineService {
  const { h2h, congestion, ml } = makeDeps();
  return new BettingEngineService(
    prisma,
    h2h,
    congestion,
    ml,
    undefined,
    undefined,
    makeChannelDecisionServiceMock(),
  );
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
