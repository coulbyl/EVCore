import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { AvoidStrategy, decideAvoid } from './avoid.strategy';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
  type StrategyChannel,
  type StrategyContext,
  type StrategyDecision,
} from '../channel-strategy.types';
import type { MatchProbabilities } from '../betting-engine.types';

// A SELECTED primary decision carrying one priced 1X2 selection.
function selected(
  channel: StrategyChannel,
  opts: { pick: string; probability: number; odds?: number },
): StrategyDecision {
  return {
    channel,
    status: CHANNEL_DECISION_STATUS.SELECTED,
    selections: [
      {
        market: Market.ONE_X_TWO,
        pick: opts.pick,
        probability: new Decimal(opts.probability),
        ...(opts.odds ? { odds: new Decimal(opts.odds) } : {}),
        rank: 1,
      },
    ],
  };
}

function ctx(decisions: StrategyDecision[]): StrategyContext {
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
    odds: null,
    signals: {
      suspendedMarkets: new Set(),
      lambdaFloorHit: false,
      lambdaTotal: 2.5,
      lineMovement: null,
      h2h: null,
      congestion: null,
    },
    previousDecisions,
    selectionConfig: {
      leagueEvThreshold: new Decimal('0.08'),
      svMinProbability: new Decimal('0.68'),
      svMinOdds: new Decimal('1.15'),
      htftCalibrated: false,
      pickDirectionProbabilityThreshold: () => new Decimal('0'),
      pickEvFloor: (_m: unknown, _p: unknown, leagueFloor: Decimal) =>
        leagueFloor,
      pickEvSoftCap: () => new Decimal('0.90'),
      pickMinSelectionOdds: () => new Decimal('1.15'),
      pickMaxSelectionOdds: () => null,
    },
    modelScoreThreshold: new Decimal('0.5'),
  };
}

const ON = { enabled: true, maxEdge: 0.3 };

describe('decideAvoid', () => {
  it('returns DISABLED when config is off', () => {
    const d = decideAvoid(
      ctx([selected('VALUE', { pick: 'HOME', probability: 0.9, odds: 2.5 })]),
      {
        enabled: false,
        maxEdge: 0.3,
      },
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('REJECTS no_avoid_signal when no pick is extreme', () => {
    // edge = 0.60 − 1/1.90 ≈ 0.074 < 0.30
    const d = decideAvoid(
      ctx([selected('VALUE', { pick: 'HOME', probability: 0.6, odds: 1.9 })]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(d.reasonCode).toBe('no_avoid_signal');
    expect(d.selections).toHaveLength(0);
  });

  it('flags avoidance on extreme divergence (edge ≥ maxEdge), with offenders', () => {
    // edge = 0.70 − 1/2.50 = 0.30 → triggers at the boundary
    const d = decideAvoid(
      ctx([selected('VALUE', { pick: 'AWAY', probability: 0.7, odds: 2.5 })]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(d.reasonCode).toBe('extreme_divergence');
    expect(d.selections).toHaveLength(0); // negative decision — no pick
    const details = d.reasonDetails as { offenders: Array<{ pick: string }> };
    expect(details.offenders).toHaveLength(1);
    expect(details.offenders[0].pick).toBe('AWAY');
  });

  it('ignores selections without odds (edge not computable)', () => {
    const d = decideAvoid(
      ctx([selected('DOMINANT', { pick: 'HOME', probability: 0.95 })]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
  });

  it('does not consider REJECTED primaries', () => {
    const rejected: StrategyDecision = {
      channel: 'VALUE',
      status: CHANNEL_DECISION_STATUS.REJECTED,
      selections: [],
    };
    const d = decideAvoid(ctx([rejected]), ON);
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
  });

  it('collects multiple offenders across channels', () => {
    const d = decideAvoid(
      ctx([
        selected('VALUE', { pick: 'HOME', probability: 0.75, odds: 2.5 }), // edge 0.35
        selected('DOMINANT', { pick: 'AWAY', probability: 0.8, odds: 3.0 }), // edge ~0.467
      ]),
      ON,
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    const details = d.reasonDetails as { offenders: unknown[] };
    expect(details.offenders).toHaveLength(2);
  });
});

describe('AvoidStrategy (class)', () => {
  it('emits no pick — allowedMarkets is empty', () => {
    expect(new AvoidStrategy().allowedMarkets).toEqual([]);
  });

  it('channel is AVOID', () => {
    expect(new AvoidStrategy().channel).toBe(STRATEGY_CHANNEL.AVOID);
  });
});
