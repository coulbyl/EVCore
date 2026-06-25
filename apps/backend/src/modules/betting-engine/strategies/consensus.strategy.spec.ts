import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { ConsensusStrategy, decideConsensus } from './consensus.strategy';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type StrategyChannel,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';

const BASE_ODDS: FullOddsSnapshot = {
  bookmaker: 'Pinnacle',
  snapshotAt: new Date(),
  homeOdds: new Decimal('2.00'),
  drawOdds: new Decimal('3.30'),
  awayOdds: new Decimal('4.00'),
  overUnderOdds: {},
  bttsYesOdds: null,
  bttsNoOdds: null,
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
};

// Build a SELECTED primary decision on one (market, pick).
function selected(
  channel: StrategyChannel,
  pick: string,
  opts: { probability: number; market?: Market },
): StrategyDecision {
  const market = opts.market ?? Market.ONE_X_TWO;
  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      { market, pick, probability: new Decimal(opts.probability), rank: 1 },
    ],
  };
}

function ctx(
  decisions: StrategyDecision[],
  odds: FullOddsSnapshot | null = BASE_ODDS,
): StrategyContext {
  const previousDecisions = new Map<StrategyChannel, StrategyDecision>();
  for (const d of decisions) previousDecisions.set(d.channel, d);
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
    deterministicScore: new Decimal('0.7'),
    probabilities: {} as unknown as MatchProbabilities,
    evaluatedMarkets: [],
    odds,
    signals: {
      suspendedMarkets: new Set(),
      lambdaFloorHit: false,
      lambdaTotal: 2.5,
      lineMovement: null,
      h2h: null,
      congestion: null,
    },
    previousDecisions,
  };
}

const ON = { enabled: true, minLevel: 2 };

describe('decideConsensus', () => {
  it('returns DISABLED when config is off', () => {
    const d = decideConsensus(
      ctx([selected('DOMINANT', 'HOME', { probability: 0.6 })]),
      {
        enabled: false,
        minLevel: 2,
      },
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('REJECTED no_consensus when only one independence class agrees', () => {
    const d = decideConsensus(
      ctx([selected('DOMINANT', 'HOME', { probability: 0.6 })]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(d.reasonCode).toBe('no_consensus');
    expect(d.reasonDetails).toMatchObject({ bestLevel: 1, minLevel: 2 });
  });

  it('SELECTED when two independent classes agree on a pick', () => {
    // DOMINANT (directional) + VALUE (value) both pick HOME → level 2
    const d = decideConsensus(
      ctx([
        selected('DOMINANT', 'HOME', { probability: 0.6 }),
        selected('VALUE', 'HOME', { probability: 0.58 }),
      ]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(d.selections[0].pick).toBe('HOME');
    expect(d.selections[0].market).toBe(Market.ONE_X_TWO);
    expect(d.selections[0].qualityScore?.toNumber()).toBe(2);
    expect(d.reasonDetails).toMatchObject({ level: 2 });
  });

  it('collapses same-class channels to one vote (VALUE + SAFE = 1 level)', () => {
    // Both are class "value" → only 1 distinct class → no consensus at minLevel 2
    const d = decideConsensus(
      ctx([
        selected('VALUE', 'HOME', { probability: 0.6 }),
        selected('SAFE', 'HOME', { probability: 0.59 }),
      ]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
  });

  it('uses the max agreeing probability and prices via the snapshot', () => {
    const d = decideConsensus(
      ctx([
        selected('DOMINANT', 'HOME', { probability: 0.62 }),
        selected('VALUE', 'HOME', { probability: 0.58 }),
      ]),
      ON,
    );
    const sel = d.selections[0];
    expect(sel.probability.toNumber()).toBeCloseTo(0.62);
    expect(sel.odds?.toNumber()).toBe(2.0);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.62 * 2.0 - 1, 10);
  });

  it('ignores non-1X2 agreement in v1 (BTTS consensus does not count)', () => {
    const d = decideConsensus(
      ctx([
        selected('BTTS', 'YES', { probability: 0.6, market: Market.BTTS }),
        selected('VALUE', 'YES', { probability: 0.58, market: Market.BTTS }),
      ]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
  });

  it('picks the highest-level pick across competing picks', () => {
    // HOME: directional+value (2). DRAW: market_draw only (1). → HOME wins.
    const d = decideConsensus(
      ctx([
        selected('DOMINANT', 'HOME', { probability: 0.55 }),
        selected('VALUE', 'HOME', { probability: 0.57 }),
        selected('DRAW', 'DRAW', { probability: 0.33 }),
      ]),
      ON,
    );
    expect(d.selections[0].pick).toBe('HOME');
  });

  it('does not count REJECTED/DISABLED primaries as votes', () => {
    const rejected: StrategyDecision = {
      channel: 'VALUE',
      status: CHANNEL_DECISION_STATUS.REJECTED,
      selections: [],
    };
    const d = decideConsensus(
      ctx([selected('DOMINANT', 'HOME', { probability: 0.6 }), rejected]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
  });
});

describe('ConsensusStrategy (class)', () => {
  it('allowedMarkets contains only ONE_X_TWO', () => {
    expect(new ConsensusStrategy().allowedMarkets).toEqual([Market.ONE_X_TWO]);
  });

  it('channel is CONSENSUS', () => {
    expect(new ConsensusStrategy().channel).toBe(STRATEGY_CHANNEL.CONSENSUS);
  });
});
