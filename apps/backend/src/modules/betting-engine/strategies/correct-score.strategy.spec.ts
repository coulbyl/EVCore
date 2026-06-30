import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  CorrectScoreStrategy,
  Market,
  computeCorrectScoreMatrix,
} from '@evcore/analysis-core';
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

function makeContext(opts: {
  lambdaHome?: number;
  lambdaAway?: number;
  correctScoreOdds?: Record<string, Decimal>;
}): StrategyContext {
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
    deterministicScore: new Decimal('0.65'),
    lambdaHome: opts.lambdaHome,
    lambdaAway: opts.lambdaAway,
    probabilities: {} as unknown as MatchProbabilities,
    evaluatedMarkets: [],
    odds: opts.correctScoreOdds
      ? { ...BASE_ODDS, correctScoreOdds: opts.correctScoreOdds }
      : BASE_ODDS,
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

describe('CorrectScoreStrategy', () => {
  const strategy = new CorrectScoreStrategy();

  it('allowedMarkets contains only CORRECT_SCORE', () => {
    expect(strategy.allowedMarkets).toEqual([Market.CORRECT_SCORE]);
  });

  it('REJECTED (no_model) when lambdas are absent', () => {
    const d = strategy.evaluate(
      makeContext({ correctScoreOdds: { '1:0': new Decimal('5') } }),
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(d.reasonCode).toBe('no_model');
  });

  it('REJECTED (no_odds) when the book prices no scoreline', () => {
    const d = strategy.evaluate(
      makeContext({ lambdaHome: 1.5, lambdaAway: 1.1 }),
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(d.reasonCode).toBe('no_odds');
  });

  it('emits the highest-EV priced scoreline the model can price', () => {
    const matrix = computeCorrectScoreMatrix(1.5, 1.1);
    // Price two scorelines; give "1:1" odds rich enough to be the best EV.
    const p10 = matrix['1:0'].toNumber();
    const p11 = matrix['1:1'].toNumber();
    // Fair odds = 1/p; inflate 1:1 above fair so its EV beats 1:0 at fair odds.
    const odds = {
      '1:0': new Decimal((1 / p10).toFixed(2)),
      '1:1': new Decimal((1.5 / p11).toFixed(2)),
    };
    const d = strategy.evaluate(
      makeContext({ lambdaHome: 1.5, lambdaAway: 1.1, correctScoreOdds: odds }),
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(d.selections[0]?.market).toBe(Market.CORRECT_SCORE);
    expect(d.selections[0]?.pick).toBe('1:1');
    expect(d.selections[0]?.ev?.greaterThan(0)).toBe(true);
  });

  it('skips deep-longshot cells below the probability floor', () => {
    // "6:0" has negligible model probability → filtered even at huge odds; with
    // no other priced line, the decision is REJECTED (no_modelable_scoreline).
    const d = strategy.evaluate(
      makeContext({
        lambdaHome: 1.2,
        lambdaAway: 1.0,
        correctScoreOdds: { '6:0': new Decimal('500') },
      }),
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(d.reasonCode).toBe('no_modelable_scoreline');
  });
});
