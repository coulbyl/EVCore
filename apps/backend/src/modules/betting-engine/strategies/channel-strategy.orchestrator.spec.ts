import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { ChannelStrategyOrchestrator } from './channel-strategy.orchestrator';
import { createChannelStrategyOrchestrator, V1_STRATEGIES } from './registry';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type ChannelStrategy,
  type StrategyChannel,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';

const BASE_ODDS: FullOddsSnapshot = {
  bookmaker: 'Pinnacle',
  snapshotAt: new Date(),
  homeOdds: new Decimal('1.90'),
  drawOdds: new Decimal('3.30'), // implied 0.303 ≥ BL1 DRAW threshold 0.28
  awayOdds: new Decimal('4.50'),
  overUnderOdds: {},
  bttsYesOdds: null,
  bttsNoOdds: null,
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
};

function pick(overrides: Partial<EvaluatedPick>): EvaluatedPick {
  return {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    probability: new Decimal('0.60'),
    odds: new Decimal('1.90'),
    ev: new Decimal('0.14'),
    qualityScore: new Decimal('0.20'),
    isCombo: false,
    ...overrides,
  };
}

function makeContext(
  overrides: Partial<StrategyContext> = {},
): StrategyContext {
  return {
    fixture: {
      id: 'f1',
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      scheduledAt: new Date(),
    },
    competitionCode: 'BL1',
    sport: 'FOOTBALL',
    phase: 'PRE_KICKOFF',
    deterministicScore: new Decimal('0.80'),
    probabilities: {
      home: new Decimal('0.60'),
      draw: new Decimal('0.25'),
      away: new Decimal('0.15'),
      bttsYes: new Decimal('0.65'), // ≥ BL1 BTTS threshold 0.60
      bttsNo: new Decimal('0.35'),
    } as unknown as MatchProbabilities,
    evaluatedMarkets: [
      // EV picks this (highest qualityScore); too low prob for SAFE.
      { market: Market.ONE_X_TWO, picks: [pick({})] },
      // SAFE picks this (prob ≥ 0.68, ev/odds in range); excluded from EV.
      {
        market: Market.OVER_UNDER,
        picks: [
          pick({
            market: Market.OVER_UNDER,
            pick: 'UNDER_4_5',
            probability: new Decimal('0.84'),
            odds: new Decimal('1.27'),
            ev: new Decimal('0.067'),
            qualityScore: new Decimal('0.05'),
          }),
        ],
      },
    ],
    odds: BASE_ODDS,
    signals: {
      suspendedMarkets: new Set(),
      lambdaFloorHit: false,
      lambdaTotal: 2.5,
      lineMovement: null,
      h2h: null,
      congestion: null,
    },
    previousDecisions: new Map(),
    ...overrides,
  };
}

function byChannel(
  decisions: StrategyDecision[],
): Map<StrategyChannel, StrategyDecision> {
  return new Map(decisions.map((d) => [d.channel, d]));
}

describe('ChannelStrategyOrchestrator (multi-channel)', () => {
  it('produces one decision per primary strategy for a rich BL1 context', () => {
    const decisions =
      createChannelStrategyOrchestrator().evaluate(makeContext());
    const map = byChannel(decisions);

    expect(decisions).toHaveLength(V1_STRATEGIES.length);
    for (const channel of [
      STRATEGY_CHANNEL.EV,
      STRATEGY_CHANNEL.SAFE,
      STRATEGY_CHANNEL.DOMINANT,
      STRATEGY_CHANNEL.BTTS,
      STRATEGY_CHANNEL.DRAW,
    ]) {
      expect(map.get(channel)?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    }
  });

  it('routes each channel to its own market/pick', () => {
    const map = byChannel(
      createChannelStrategyOrchestrator().evaluate(makeContext()),
    );

    expect(map.get(STRATEGY_CHANNEL.EV)?.selections[0]?.market).toBe(
      Market.ONE_X_TWO,
    );
    expect(map.get(STRATEGY_CHANNEL.EV)?.selections[0]?.pick).toBe('HOME');
    expect(map.get(STRATEGY_CHANNEL.SAFE)?.selections[0]?.market).toBe(
      Market.OVER_UNDER,
    );
    expect(map.get(STRATEGY_CHANNEL.DOMINANT)?.selections[0]?.pick).toBe(
      'HOME',
    );
    expect(map.get(STRATEGY_CHANNEL.BTTS)?.selections[0]?.pick).toBe('YES');
    expect(map.get(STRATEGY_CHANNEL.DRAW)?.selections[0]?.pick).toBe('DRAW');
  });

  it('throws when a strategy selects outside its allowedMarkets', () => {
    const rogue: ChannelStrategy = {
      channel: STRATEGY_CHANNEL.DOMINANT,
      allowedMarkets: [Market.ONE_X_TWO],
      evaluate: () => ({
        channel: STRATEGY_CHANNEL.DOMINANT,
        status: CHANNEL_DECISION_STATUS.SELECTED,
        selections: [
          {
            market: Market.BTTS,
            pick: 'YES',
            probability: new Decimal('0.7'),
            rank: 1,
          },
        ],
      }),
    };
    const orchestrator = new ChannelStrategyOrchestrator([rogue]);
    expect(() => orchestrator.evaluate(makeContext())).toThrow(
      /disallowed market/,
    );
  });

  it('skips strategies not applicable to the context sport', () => {
    const tennisOnly: ChannelStrategy = {
      channel: STRATEGY_CHANNEL.EV,
      allowedMarkets: [Market.ONE_X_TWO],
      // Empty allowedSports → never includes FOOTBALL → always skipped.
      allowedSports: [],
      evaluate: () => {
        throw new Error('should not be evaluated');
      },
    };
    const orchestrator = new ChannelStrategyOrchestrator([tennisOnly]);
    expect(orchestrator.evaluate(makeContext())).toEqual([]);
  });
});
