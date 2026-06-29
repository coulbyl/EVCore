import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
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
    phase: 'PRE_KICKOFF',
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

  it('returns DISABLED for leagues where DOMINANT is explicitly disabled (D2)', () => {
    // D2: DOMINANT disabled, threshold 0.55
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
    // BL1 threshold = 0.55
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
    // LL threshold = 0.50, DOMINANT_MIN_MARGIN = 0.05. Uses LL (not BL1) because
    // the margin gate is only reachable below ~0.525: any argmax clearing BL1's
    // 0.55 necessarily leads the 2nd by > 0.05 once probabilities sum to ≤ 1.
    // 0.52 HOME vs 0.48 DRAW → argmax 0.52 ≥ 0.50, margin = 0.04 < 0.05.
    const ctx = makeContext({
      home: 0.52,
      draw: 0.48,
      away: 0.0,
      competitionCode: 'LL',
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('insufficient_margin');
  });

  it('returns SELECTED with HOME when home is dominant', () => {
    // BL1: threshold = 0.55, HOME = 0.60, margin = 0.35 > 0.05
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

  it('attaches the winning pick odds, implied probability and EV', () => {
    const ctx = makeContext({
      home: 0.6,
      draw: 0.25,
      away: 0.15,
      competitionCode: 'BL1',
    });
    const sel = strategy.evaluate(ctx).selections[0];
    expect(sel.pick).toBe('HOME');
    expect(sel.odds?.toNumber()).toBe(1.5); // BASE_ODDS.homeOdds
    expect(sel.impliedProbability?.toNumber()).toBeCloseTo(1 / 1.5, 10);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.6 * 1.5 - 1, 10);
  });

  it('records a price-less selection when no odds snapshot exists', () => {
    const ctx = makeContext({
      home: 0.6,
      draw: 0.25,
      away: 0.15,
      competitionCode: 'BL1',
    });
    const sel = strategy.evaluate({ ...ctx, odds: null }).selections[0];
    expect(sel.pick).toBe('HOME');
    expect(sel.odds).toBeUndefined();
    expect(sel.ev).toBeUndefined();
  });
});
