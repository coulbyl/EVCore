import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import {
  WinEitherHalfStrategy,
  decideWinEitherHalf,
} from './win-either-half.strategy';
import type { ChannelStrategyLeagueConfig } from './channel-strategy.config';
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
  winEitherHalfHome: number,
  winEitherHalfAway: number,
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
      winEitherHalfHome: new Decimal(winEitherHalfHome),
      winEitherHalfAway: new Decimal(winEitherHalfAway),
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

const ENABLED: ChannelStrategyLeagueConfig = {
  enabled: true,
  threshold: 0.6,
  minSampleN: 20,
};

describe('decideWinEitherHalf (pure)', () => {
  it('returns DISABLED when the config is disabled', () => {
    const decision = decideWinEitherHalf(makeContext(0.7, 0.4), {
      enabled: false,
      threshold: 0.6,
      minSampleN: 20,
    });
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it('returns REJECTED below_threshold when neither side clears the threshold', () => {
    const decision = decideWinEitherHalf(makeContext(0.5, 0.4), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('selects HOME when only winEitherHalfHome clears the threshold', () => {
    const decision = decideWinEitherHalf(makeContext(0.7, 0.4), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.TO_WIN_EITHER_HALF);
    expect(decision.selections[0].pick).toBe('HOME');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.7);
  });

  // Both sides can legitimately clear the threshold together — the two
  // events overlap (a team can win one half while the other wins the other),
  // unlike DOMINANT/DRAW's mutually-exclusive 1X2 outcomes.
  it('prefers the more confident side when both clear the threshold', () => {
    const decision = decideWinEitherHalf(makeContext(0.62, 0.68), ENABLED);
    expect(decision.selections[0].pick).toBe('AWAY');
  });

  it('selects at exactly the threshold (boundary — lessThan, not lte)', () => {
    const decision = decideWinEitherHalf(makeContext(0.6, 0.3), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(0.7, 0.4, {
      odds: {
        ...BASE_ODDS,
        winEitherHalfOdds: {
          home: new Decimal('1.40'),
          away: new Decimal('2.50'),
        },
      },
    });
    const sel = decideWinEitherHalf(ctx, ENABLED).selections[0];
    expect(sel.odds?.toNumber()).toBe(1.4);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.7 * 1.4 - 1, 10);
  });

  it('records a price-less selection when no win-either-half odds exist', () => {
    const sel = decideWinEitherHalf(makeContext(0.7, 0.4), ENABLED)
      .selections[0];
    expect(sel.odds).toBeUndefined();
    expect(sel.ev).toBeUndefined();
  });
});

describe('WinEitherHalfStrategy (class, prod config)', () => {
  const strategy = new WinEitherHalfStrategy();

  // BL1 runs in OBSERVATION mode (threshold 0.52, derived from its real
  // wins-a-half base rate — see WIN_EITHER_HALF_CONFIG) — no backtested edge yet.
  it('is SELECTED for an active league in observation mode (BL1)', () => {
    expect(
      strategy.evaluate(makeContext(0.8, 0.8, { competitionCode: 'BL1' }))
        .status,
    ).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it('is DISABLED for a league with no derived config', () => {
    expect(
      strategy.evaluate(
        makeContext(0.8, 0.8, { competitionCode: 'UNKNOWN_LEAGUE' }),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('allowedMarkets contains only TO_WIN_EITHER_HALF', () => {
    expect(strategy.allowedMarkets).toEqual([Market.TO_WIN_EITHER_HALF]);
  });
});
