import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { DrawStrategy } from './draw.strategy';
import { CHANNEL_DECISION_STATUS } from '../channel-strategy.types';
import type { StrategyContext } from '../channel-strategy.types';
import type {
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';

const BASE_PROBS = {
  home: new Decimal('0.45'),
  draw: new Decimal('0.30'),
  away: new Decimal('0.25'),
  bttsYes: new Decimal('0.50'),
  bttsNo: new Decimal('0.50'),
} as unknown as MatchProbabilities;

function makeOdds(drawOdds: Decimal | null): FullOddsSnapshot {
  return {
    bookmaker: 'Pinnacle',
    snapshotAt: new Date(),
    homeOdds: new Decimal('2.10'),
    drawOdds: drawOdds ?? new Decimal('3.30'),
    awayOdds: new Decimal('3.50'),
    overUnderOdds: {},
    bttsYesOdds: null,
    bttsNoOdds: null,
    htftOdds: {},
    ouHtOdds: {},
    firstHalfWinnerOdds: null,
    doubleChanceOdds: null,
    drawNoBetOdds: null,
    teamTotalHomeOdds: {},
    teamTotalAwayOdds: {},
    cleanSheetHomeOdds: null,
    cleanSheetAwayOdds: null,
    winToNilHomeOdds: null,
    winToNilAwayOdds: null,
    winEitherHalfOdds: null,
  };
}

function makeContext(
  drawOdds: number | null,
  competitionCode = 'I2',
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
    probabilities: BASE_PROBS,
    evaluatedMarkets: [],
    odds: drawOdds !== null ? makeOdds(new Decimal(drawOdds)) : null,
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

describe('DrawStrategy', () => {
  const strategy = new DrawStrategy();

  it('returns DISABLED for leagues where DRAW is not configured', () => {
    expect(strategy.evaluate(makeContext(3.2, 'UNKNOWN_LEAGUE')).status).toBe(
      CHANNEL_DECISION_STATUS.DISABLED,
    );
  });

  it('returns DISABLED for SP2 (DRAW explicitly disabled after backtest)', () => {
    // SP2 DRAW is configured but disabled (structurally weak signal). PL is no
    // longer a disabled example — tuning 2026-06-24 promoted PL DRAW at 0.30.
    expect(strategy.evaluate(makeContext(3.2, 'SP2')).status).toBe(
      CHANNEL_DECISION_STATUS.DISABLED,
    );
  });

  it('returns MISSING_ODDS when odds is null', () => {
    expect(strategy.evaluate(makeContext(null, 'I2')).status).toBe(
      CHANNEL_DECISION_STATUS.MISSING_ODDS,
    );
  });

  it('returns REJECTED below_threshold when 1/drawOdds < threshold', () => {
    // I2 threshold = 0.30 → drawOdds must be < 1/0.30 = 3.33 to pass
    // drawOdds = 4.00 → implied = 0.25 < 0.30 → rejected
    const decision = strategy.evaluate(makeContext(4.0, 'I2'));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('returns SELECTED when 1/drawOdds ≥ threshold', () => {
    // I2 threshold = 0.30 → drawOdds = 3.00 → implied = 0.333 > 0.30 → selected
    const decision = strategy.evaluate(makeContext(3.0, 'I2'));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.ONE_X_TWO);
    expect(decision.selections[0].pick).toBe('DRAW');
    expect(decision.selections[0].rank).toBe(1);
    // implied probability = 1/3.00 ≈ 0.333
    expect(decision.selections[0].impliedProbability?.toNumber()).toBeCloseTo(
      1 / 3,
      3,
    );
  });

  it('uses bookmaker implied probability, not model draw probability', () => {
    // Model draw = 0.30, 1/drawOdds = 0.333 — DRAW uses the latter
    const decision = strategy.evaluate(makeContext(3.0, 'I2'));
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(1 / 3, 3);
  });

  it('allowedMarkets contains only ONE_X_TWO', () => {
    expect(strategy.allowedMarkets).toEqual([Market.ONE_X_TWO]);
  });

  it('BL1 threshold = 0.28 → drawOdds 3.57 passes, 3.60 fails', () => {
    // 1/3.57 ≈ 0.280 ≥ 0.28 → passes
    expect(strategy.evaluate(makeContext(3.57, 'BL1')).status).toBe(
      CHANNEL_DECISION_STATUS.SELECTED,
    );
    // 1/3.60 ≈ 0.278 < 0.28 → rejected
    expect(strategy.evaluate(makeContext(3.6, 'BL1')).status).toBe(
      CHANNEL_DECISION_STATUS.REJECTED,
    );
  });
});
