import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import { DominantStrategy } from './dominant.strategy';
import { CHANNEL_DECISION_STATUS } from '../channel-strategy.types';
import type { StrategyContext } from '../channel-strategy.types';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';

const BASE_ODDS: FullOddsSnapshot = {
  bookmaker: 'Pinnacle',
  snapshotAt: new Date(),
  homeOdds: new Decimal('1.50'),
  drawOdds: new Decimal('4.00'),
  awayOdds: new Decimal('6.00'),
  overUnderOdds: {},
  bttsYesOdds: null,
  bttsNoOdds: null,
  htftOdds: {},
  ouHtOdds: {},
  firstHalfWinnerOdds: null,
  doubleChanceOdds: null,
};

function makeContext(opts: {
  home: number;
  draw: number;
  away: number;
  competitionCode?: string;
}): StrategyContext {
  const { home, draw, away, competitionCode = 'BL1' } = opts;
  return {
    fixture: {
      id: 'f1',
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      scheduledAt: new Date(),
    },
    competitionCode,
    sport: 'FOOTBALL',
    deterministicScore: new Decimal('0.65'),
    probabilities: {
      home: new Decimal(home),
      draw: new Decimal(draw),
      away: new Decimal(away),
      bttsYes: new Decimal('0.45'),
      bttsNo: new Decimal('0.55'),
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

describe('DominantStrategy', () => {
  const strategy = new DominantStrategy();

  it('returns DISABLED for leagues without CONF config (unknown league)', () => {
    const ctx = makeContext({
      home: 0.55,
      draw: 0.25,
      away: 0.2,
      competitionCode: 'UNKNOWN_LEAGUE',
    });
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.DISABLED,
    );
  });

  it('returns DISABLED for leagues where CONF is explicitly disabled (PL DRAW is disabled — use D2 CONF)', () => {
    // D2: CONF disabled, threshold 0.55
    const ctx = makeContext({
      home: 0.6,
      draw: 0.25,
      away: 0.15,
      competitionCode: 'D2',
    });
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.DISABLED,
    );
  });

  it('returns REJECTED below_threshold when argmax probability < league threshold', () => {
    // BL1 threshold = 0.50
    const ctx = makeContext({
      home: 0.45,
      draw: 0.35,
      away: 0.2,
      competitionCode: 'BL1',
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('returns REJECTED insufficient_margin when argmax barely leads', () => {
    // BL1 threshold = 0.50, CONF_MIN_MARGIN = 0.05
    // 0.52 HOME vs 0.48 DRAW → margin = 0.04 < 0.05
    const ctx = makeContext({
      home: 0.52,
      draw: 0.48,
      away: 0.0,
      competitionCode: 'BL1',
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('insufficient_margin');
  });

  it('returns SELECTED with HOME when home is dominant', () => {
    // BL1: threshold = 0.50, HOME = 0.60, margin = 0.35 > 0.05
    const ctx = makeContext({
      home: 0.6,
      draw: 0.25,
      away: 0.15,
      competitionCode: 'BL1',
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.ONE_X_TWO);
    expect(decision.selections[0].pick).toBe('HOME');
    expect(decision.selections[0].rank).toBe(1);
  });

  it('returns SELECTED with AWAY when away team is dominant', () => {
    // BL1: AWAY = 0.65, margin = 0.65 - 0.30 = 0.35 > 0.05
    const ctx = makeContext({
      home: 0.2,
      draw: 0.15,
      away: 0.65,
      competitionCode: 'BL1',
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].pick).toBe('AWAY');
  });

  it('allowedMarkets only contains ONE_X_TWO', () => {
    expect(strategy.allowedMarkets).toEqual([Market.ONE_X_TWO]);
  });

  it('selection has no odds field (DOMINANT does not require odds snapshot)', () => {
    const ctx = makeContext({
      home: 0.6,
      draw: 0.25,
      away: 0.15,
      competitionCode: 'BL1',
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.selections[0].odds).toBeUndefined();
  });
});
