import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { SafeStrategy } from './safe.strategy';
import {
  CHANNEL_DECISION_STATUS,
  STRATEGY_CHANNEL,
} from '../channel-strategy.types';
import type {
  StrategyContext,
  StrategyDecision,
} from '../channel-strategy.types';
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
  drawNoBetOdds: null,
  teamTotalHomeOdds: {},
  teamTotalAwayOdds: {},
  cleanSheetHomeOdds: null,
  cleanSheetAwayOdds: null,
  winToNilHomeOdds: null,
  winToNilAwayOdds: null,
  winEitherHalfOdds: null,
  resultTotalGoalsOdds: {},
  resultBttsOdds: {},
};

function makeSafePick(overrides: Partial<EvaluatedPick> = {}): EvaluatedPick {
  return {
    market: Market.ONE_X_TWO,
    pick: 'HOME',
    // High probability, low EV — typical safe value profile
    // ev must be ≥ SAFE_VALUE_MIN_EV (0.05), odds in [1.15, 2.20], prob ≥ 0.68
    probability: new Decimal('0.72'),
    odds: new Decimal('1.45'),
    ev: new Decimal('0.06'),
    qualityScore: new Decimal('0.08'),
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
    modelScoreThreshold: new Decimal('0.60'),
    previousDecisions: new Map(),
    ...overrides,
  };
}

describe('SafeStrategy', () => {
  const strategy = new SafeStrategy();

  it('returns MISSING_ODDS when odds is null', () => {
    expect(strategy.evaluate(makeContext({ odds: null })).status).toBe(
      CHANNEL_DECISION_STATUS.MISSING_ODDS,
    );
  });

  it('returns REJECTED with score_below_threshold when score < 0.60', () => {
    const decision = strategy.evaluate(
      makeContext({ deterministicScore: new Decimal('0.55') }),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('score_below_threshold');
  });

  it('returns SELECTED with a high-probability single pick', () => {
    const pick = makeSafePick();
    const ctx = makeContext({
      evaluatedMarkets: [{ market: Market.ONE_X_TWO, picks: [pick] }],
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.72);
    expect(decision.selections[0].rank).toBe(1);
  });

  it('excludes the EV pick from SAFE candidates', () => {
    const evPickKey = 'ONE_X_TWO|HOME|-|-';
    const evDecision: StrategyDecision = {
      channel: STRATEGY_CHANNEL.VALUE,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: Market.ONE_X_TWO,
          pick: 'HOME',
          probability: new Decimal('0.65'),
          rank: 1,
        },
      ],
    };
    const safeAlt = makeSafePick({
      pick: 'AWAY',
      probability: new Decimal('0.70'),
      odds: new Decimal('1.45'),
      ev: new Decimal('0.06'),
    });
    const evPick = makeSafePick({
      pick: 'HOME',
      probability: new Decimal('0.72'),
      odds: new Decimal('1.40'),
      ev: new Decimal('0.06'),
    });
    const ctx = makeContext({
      evaluatedMarkets: [
        { market: Market.ONE_X_TWO, picks: [evPick, safeAlt] },
      ],
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
      modelScoreThreshold: new Decimal('0.60'),
      previousDecisions: new Map([[STRATEGY_CHANNEL.VALUE, evDecision]]),
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    // HOME is excluded (matches EV pick key), so AWAY is selected
    expect(decision.selections[0].pick).toBe('AWAY');

    void evPickKey; // suppress lint
  });

  it('only selects from SAFE markets (ONE_X_TWO, OVER_UNDER, BTTS, OVER_UNDER_HT)', () => {
    // A pick on an unsupported market (DOUBLE_CHANCE) should not be selected
    const pick = makeSafePick({ market: Market.DOUBLE_CHANCE, pick: '1X' });
    const ctx = makeContext({
      evaluatedMarkets: [{ market: Market.DOUBLE_CHANCE, picks: [pick] }],
    });
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.REJECTED,
    );
  });

  it('allowedMarkets does not include DOUBLE_CHANCE or HALF_TIME_FULL_TIME', () => {
    expect(strategy.allowedMarkets).not.toContain(Market.DOUBLE_CHANCE);
    expect(strategy.allowedMarkets).not.toContain(Market.HALF_TIME_FULL_TIME);
  });
});
