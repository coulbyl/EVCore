import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { buildStrategyContext } from './strategy-context.builder';
import type {
  EvaluatedPick,
  MatchProbabilities,
} from '../betting-engine.types';
import type { ContextSignals } from '../channel-strategy.types';

function pick(overrides: Partial<EvaluatedPick> = {}): EvaluatedPick {
  return {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    probability: new Decimal('0.55'),
    odds: new Decimal('1.9'),
    ev: new Decimal('0.045'),
    qualityScore: new Decimal('0.03'),
    isCombo: false,
    ...overrides,
  };
}

const PROBABILITIES = {
  home: new Decimal('0.55'),
  draw: new Decimal('0.27'),
  away: new Decimal('0.18'),
  bttsYes: new Decimal('0.5'),
  bttsNo: new Decimal('0.5'),
} as unknown as MatchProbabilities;

const SIGNALS: ContextSignals = {
  suspendedMarkets: new Set(),
  lambdaFloorHit: false,
  lambdaTotal: 2.6,
  lineMovement: null,
  h2h: null,
  congestion: null,
};

function baseInput() {
  return {
    fixture: {
      id: 'f1',
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      scheduledAt: new Date('2026-01-01T12:00:00.000Z'),
    },
    competitionCode: 'BL1',
    deterministicScore: new Decimal('0.7'),
    probabilities: PROBABILITIES,
    evaluatedPicks: [] as EvaluatedPick[],
    odds: null,
    signals: SIGNALS,
  };
}

describe('buildStrategyContext', () => {
  it('groups evaluated picks by market while preserving order within a market', () => {
    const context = buildStrategyContext({
      ...baseInput(),
      evaluatedPicks: [
        pick({ market: Market.ONE_X_TWO, pick: 'HOME' }),
        pick({ market: Market.OVER_UNDER, pick: 'OVER' }),
        pick({ market: Market.ONE_X_TWO, pick: 'AWAY' }),
      ],
    });

    expect(context.evaluatedMarkets).toHaveLength(2);
    const oneXTwo = context.evaluatedMarkets.find(
      (m) => m.market === Market.ONE_X_TWO,
    );
    expect(oneXTwo?.picks.map((p) => p.pick)).toEqual(['HOME', 'AWAY']);
    const ou = context.evaluatedMarkets.find(
      (m) => m.market === Market.OVER_UNDER,
    );
    expect(ou?.picks.map((p) => p.pick)).toEqual(['OVER']);
  });

  it('flattening evaluatedMarkets recovers every input pick', () => {
    const picks = [
      pick({ market: Market.ONE_X_TWO }),
      pick({ market: Market.BTTS, pick: 'YES' }),
      pick({ market: Market.OVER_UNDER, pick: 'UNDER' }),
    ];
    const context = buildStrategyContext({
      ...baseInput(),
      evaluatedPicks: picks,
    });
    expect(context.evaluatedMarkets.flatMap((m) => m.picks)).toHaveLength(
      picks.length,
    );
  });

  it('defaults sport and phase, and starts with no previous decisions', () => {
    const context = buildStrategyContext(baseInput());
    expect(context.sport).toBe('FOOTBALL');
    expect(context.phase).toBe('PRE_KICKOFF');
    expect(context.previousDecisions.size).toBe(0);
  });

  it('passes through scalar fields unchanged', () => {
    const input = baseInput();
    const context = buildStrategyContext(input);
    expect(context.competitionCode).toBe('BL1');
    expect(context.deterministicScore).toBe(input.deterministicScore);
    expect(context.probabilities).toBe(input.probabilities);
    expect(context.odds).toBeNull();
    expect(context.signals).toBe(input.signals);
  });
});
