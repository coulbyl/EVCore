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
  drawNoBetOdds: null,
  teamTotalHomeOdds: {},
  teamTotalAwayOdds: {},
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

  it('emits the most likely priced scoreline, ignoring a longshot with fat EV', () => {
    const matrix = computeCorrectScoreMatrix(1.5, 1.1);
    // "1:1" is the modal scoreline; "0:4" is a fat-tail longshot. Price the
    // longshot at huge odds so an argmax-EV rule would grab it — the prediction
    // channel must still pick the most probable score (1:1).
    const p11 = matrix['1:1'].toNumber();
    const p04 = matrix['0:4'].toNumber();
    expect(p11).toBeGreaterThan(p04);
    const odds = {
      '1:1': new Decimal((1 / p11).toFixed(2)), // fair → EV ≈ 0
      '0:4': new Decimal('501'), // absurd value on a noise cell
    };
    const d = strategy.evaluate(
      makeContext({ lambdaHome: 1.5, lambdaAway: 1.1, correctScoreOdds: odds }),
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(d.selections[0]?.market).toBe(Market.CORRECT_SCORE);
    expect(d.selections[0]?.pick).toBe('1:1');
    // EV is still recorded (price attached) so the bettor can judge it.
    expect(d.selections[0]?.odds).toBeDefined();
  });

  it('REJECTED (below_conviction) when even the modal scoreline is too unlikely', () => {
    // "6:0" is a deep-longshot cell far below the conviction floor; with no other
    // priced line it is the modal candidate but too unlikely to name as a score.
    const d = strategy.evaluate(
      makeContext({
        lambdaHome: 1.2,
        lambdaAway: 1.0,
        correctScoreOdds: { '6:0': new Decimal('500') },
      }),
    );
    expect(d.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(d.reasonCode).toBe('below_conviction');
  });
});
