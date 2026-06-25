import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { ValueStrategy } from './value.strategy';
import { CHANNEL_DECISION_STATUS } from '../channel-strategy.types';
import type { StrategyContext } from '../channel-strategy.types';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';

const BASE_PROBS = {
  home: new Decimal('0.55'),
  draw: new Decimal('0.25'),
  away: new Decimal('0.20'),
  bttsYes: new Decimal('0.50'),
  bttsNo: new Decimal('0.50'),
} as unknown as MatchProbabilities;

const BASE_ODDS: FullOddsSnapshot = {
  bookmaker: 'Pinnacle',
  snapshotAt: new Date(),
  homeOdds: new Decimal('1.80'),
  drawOdds: new Decimal('3.50'),
  awayOdds: new Decimal('4.50'),
  overUnderOdds: {},
  bttsYesOdds: null,
  bttsNoOdds: null,
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
};

function makePick(overrides: Partial<EvaluatedPick> = {}): EvaluatedPick {
  return {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    probability: new Decimal('0.65'),
    odds: new Decimal('1.80'),
    ev: new Decimal('0.17'),
    qualityScore: new Decimal('0.11'),
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
    competitionCode: 'PL',
    sport: 'FOOTBALL',
    phase: 'PRE_KICKOFF',
    deterministicScore: new Decimal('0.65'),
    probabilities: BASE_PROBS,
    evaluatedMarkets: [],
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

describe('ValueStrategy', () => {
  const strategy = new ValueStrategy();

  it('returns MISSING_ODDS when odds is null', () => {
    const ctx = makeContext({ odds: null });
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.MISSING_ODDS,
    );
  });

  it('returns REJECTED with score_below_threshold when score < 0.60', () => {
    const ctx = makeContext({ deterministicScore: new Decimal('0.55') });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('score_below_threshold');
    expect(decision.selections).toHaveLength(0);
  });

  it('returns REJECTED with no_viable_pick when evaluatedMarkets is empty', () => {
    const decision = strategy.evaluate(makeContext({ evaluatedMarkets: [] }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('no_viable_pick');
  });

  it('returns SELECTED with the best viable pick', () => {
    const pick = makePick({ qualityScore: new Decimal('0.12') });
    const ctx = makeContext({
      evaluatedMarkets: [{ market: Market.ONE_X_TWO, picks: [pick] }],
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections).toHaveLength(1);
    expect(decision.selections[0].market).toBe(Market.ONE_X_TWO);
    expect(decision.selections[0].pick).toBe('HOME');
    expect(decision.selections[0].rank).toBe(1);
  });

  it('returns REJECTED with line_movement when movement > 0.10', () => {
    const pick = makePick();
    const ctx = makeContext({
      evaluatedMarkets: [{ market: Market.ONE_X_TWO, picks: [pick] }],
      signals: {
        suspendedMarkets: new Set(),
        lambdaFloorHit: false,
        lambdaTotal: 2.5,
        lineMovement: 0.15,
        h2h: null,
        congestion: null,
      },
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('line_movement');
  });

  it('does not reject when line_movement is exactly at threshold (0.10)', () => {
    const pick = makePick();
    const ctx = makeContext({
      evaluatedMarkets: [{ market: Market.ONE_X_TWO, picks: [pick] }],
      signals: {
        suspendedMarkets: new Set(),
        lambdaFloorHit: false,
        lambdaTotal: 2.5,
        lineMovement: 0.1,
        h2h: null,
        congestion: null,
      },
    });
    // threshold is exclusive (> not >=)
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.SELECTED,
    );
  });

  it('falls back to FALLBACK_MIN_QUALITY_SCORE when primary pick is rejected', () => {
    const topRejected = makePick({
      qualityScore: new Decimal('0.20'),
      rejectionReason: 'odds_above_cap',
    });
    const fallback = makePick({
      qualityScore: new Decimal('0.09'),
      pick: 'AWAY',
    });
    const belowFallback = makePick({
      qualityScore: new Decimal('0.05'),
      pick: 'DRAW',
    });
    const ctx = makeContext({
      evaluatedMarkets: [
        {
          market: Market.ONE_X_TWO,
          picks: [topRejected, fallback, belowFallback],
        },
      ],
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].pick).toBe('AWAY');
  });

  it('enforces allowedMarkets — all market enum values must be listed', () => {
    // The EV channel is transverse: it must allow all currently supported markets.
    const supported = [
      Market.ONE_X_TWO,
      Market.OVER_UNDER,
      Market.BTTS,
      Market.DOUBLE_CHANCE,
      Market.HALF_TIME_FULL_TIME,
      Market.OVER_UNDER_HT,
      Market.FIRST_HALF_WINNER,
    ];
    for (const market of supported) {
      expect(strategy.allowedMarkets).toContain(market);
    }
  });
});
