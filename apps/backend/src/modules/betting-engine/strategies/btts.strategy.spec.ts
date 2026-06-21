import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { BttsStrategy } from './btts.strategy';
import { CHANNEL_DECISION_STATUS } from '../channel-strategy.types';
import type { StrategyContext } from '../channel-strategy.types';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';

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

function makeContext(
  bttsYes: number,
  competitionCode = 'BL1',
): StrategyContext {
  return {
    fixture: {
      id: 'f1',
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      scheduledAt: new Date(),
    },
    competitionCode,
    sport: 'FOOTBALL',
    phase: 'PRE_KICKOFF',
    deterministicScore: new Decimal('0.65'),
    probabilities: {
      home: new Decimal('0.50'),
      draw: new Decimal('0.25'),
      away: new Decimal('0.25'),
      bttsYes: new Decimal(bttsYes),
      bttsNo: new Decimal(1 - bttsYes),
    } as unknown as MatchProbabilities,
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
  };
}

describe('BttsStrategy', () => {
  const strategy = new BttsStrategy();

  it('returns DISABLED for leagues without BTTS config', () => {
    expect(strategy.evaluate(makeContext(0.65, 'UNKNOWN_LEAGUE')).status).toBe(
      CHANNEL_DECISION_STATUS.DISABLED,
    );
  });

  it('returns REJECTED below_threshold when bttsYes < league threshold', () => {
    // BL1 threshold = 0.60
    const decision = strategy.evaluate(makeContext(0.55, 'BL1'));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('returns SELECTED when bttsYes ≥ league threshold', () => {
    // BL1 threshold = 0.60
    const decision = strategy.evaluate(makeContext(0.65, 'BL1'));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.BTTS);
    expect(decision.selections[0].pick).toBe('YES');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.65);
    expect(decision.selections[0].rank).toBe(1);
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(0.65, 'BL1');
    const decision = strategy.evaluate({
      ...ctx,
      odds: { ...BASE_ODDS, bttsYesOdds: new Decimal('1.70') },
    });
    const sel = decision.selections[0];
    expect(sel.odds?.toNumber()).toBe(1.7);
    expect(sel.impliedProbability?.toNumber()).toBeCloseTo(1 / 1.7, 10);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.65 * 1.7 - 1, 10);
  });

  it('records a price-less selection when no BTTS odds exist', () => {
    const decision = strategy.evaluate(makeContext(0.65, 'BL1')); // BASE_ODDS.bttsYesOdds = null
    expect(decision.selections[0].odds).toBeUndefined();
    expect(decision.selections[0].ev).toBeUndefined();
  });

  it('returns SELECTED at exactly the threshold (boundary)', () => {
    // BL1 threshold = 0.60 — exactly at threshold should pass (lessThan, not lte)
    const decision = strategy.evaluate(makeContext(0.6, 'BL1'));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it('allowedMarkets contains only BTTS', () => {
    expect(strategy.allowedMarkets).toEqual([Market.BTTS]);
  });

  it('uses PL threshold (0.58) independently from BL1 (0.60)', () => {
    // 0.59 should pass PL (0.58) but fail BL1 (0.60)
    expect(strategy.evaluate(makeContext(0.59, 'PL')).status).toBe(
      CHANNEL_DECISION_STATUS.SELECTED,
    );
    expect(strategy.evaluate(makeContext(0.59, 'BL1')).status).toBe(
      CHANNEL_DECISION_STATUS.REJECTED,
    );
  });
});
