import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import {
  DoubleChanceStrategy,
  decideDoubleChance,
} from './double-chance.strategy';
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

function makeContext(
  probs: { dc1X?: number; dcX2?: number; dc12?: number },
  options: { competitionCode?: string; odds?: FullOddsSnapshot } = {},
): StrategyContext {
  return {
    fixture: {
      id: 'f1',
      homeTeamId: 'h1',
      awayTeamId: 'a1',
      scheduledAt: new Date(),
    },
    competitionCode: options.competitionCode ?? 'BL1',
    sport: 'FOOTBALL',
    phase: 'PRE_KICKOFF',
    deterministicScore: new Decimal('0.65'),
    probabilities: {
      dc1X: new Decimal(probs.dc1X ?? 0),
      dcX2: new Decimal(probs.dcX2 ?? 0),
      dc12: new Decimal(probs.dc12 ?? 0),
    } as unknown as MatchProbabilities,
    evaluatedMarkets: [],
    odds: options.odds ?? BASE_ODDS,
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
      htftCalibrated: true,
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

describe('decideDoubleChance (pure)', () => {
  it('returns REJECTED below_threshold when no combo clears minProbability', () => {
    const decision = decideDoubleChance(
      makeContext({ dc1X: 0.65, dcX2: 0.55, dc12: 0.6 }),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('returns REJECTED no_priced_pick when a clearing combo has no book price', () => {
    const decision = decideDoubleChance(makeContext({ dc1X: 0.8 }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('no_priced_pick');
  });

  it('selects 1X when it clears the threshold and has a price', () => {
    const ctx = makeContext(
      { dc1X: 0.8, dcX2: 0.5, dc12: 0.6 },
      {
        odds: {
          ...BASE_ODDS,
          doubleChanceOdds: {
            '1X': new Decimal('1.30'),
            X2: new Decimal('1.90'),
            '12': new Decimal('1.20'),
          },
        },
      },
    );
    const decision = decideDoubleChance(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.DOUBLE_CHANCE);
    expect(decision.selections[0].pick).toBe('1X');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.8);
  });

  it('among qualifying candidates, picks the highest EV', () => {
    const ctx = makeContext(
      { dc1X: 0.78, dcX2: 0.76, dc12: 0.6 },
      {
        odds: {
          ...BASE_ODDS,
          doubleChanceOdds: {
            '1X': new Decimal('1.25'),
            X2: new Decimal('1.35'),
            '12': new Decimal('1.60'),
          },
        },
      },
    );
    const decision = decideDoubleChance(ctx);
    // 1X: 0.78*1.25-1=-0.025, X2: 0.76*1.35-1=0.026
    expect(decision.selections[0].pick).toBe('X2');
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(
      { dc1X: 0.8 },
      {
        odds: {
          ...BASE_ODDS,
          doubleChanceOdds: {
            '1X': new Decimal('1.30'),
            X2: new Decimal('1.90'),
            '12': new Decimal('1.20'),
          },
        },
      },
    );
    const sel = decideDoubleChance(ctx).selections[0];
    expect(sel.odds?.toNumber()).toBe(1.3);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.8 * 1.3 - 1, 10);
  });
});

describe('DoubleChanceStrategy (class, prod config)', () => {
  const strategy = new DoubleChanceStrategy();

  it('is SELECTED for any league given a clearing, priced candidate', () => {
    const ctx = makeContext(
      { dc1X: 0.8 },
      {
        competitionCode: 'BL1',
        odds: {
          ...BASE_ODDS,
          doubleChanceOdds: {
            '1X': new Decimal('1.30'),
            X2: new Decimal('1.90'),
            '12': new Decimal('1.20'),
          },
        },
      },
    );
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.SELECTED,
    );
  });

  it('allowedMarkets contains DOUBLE_CHANCE', () => {
    expect(strategy.allowedMarkets).toEqual([Market.DOUBLE_CHANCE]);
  });
});
