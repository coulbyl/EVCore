import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import {
  HalfTimeFullTimeStrategy,
  decideHalfTimeFullTime,
} from './half-time-full-time.strategy';
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

const ALL_ZERO_HTFT: Record<string, number> = {
  HOME_HOME: 0,
  HOME_DRAW: 0,
  HOME_AWAY: 0,
  DRAW_HOME: 0,
  DRAW_DRAW: 0,
  DRAW_AWAY: 0,
  AWAY_HOME: 0,
  AWAY_DRAW: 0,
  AWAY_AWAY: 0,
};

function toDecimalMap(input: Record<string, number>): Record<string, Decimal> {
  const out: Record<string, Decimal> = {};
  for (const [k, v] of Object.entries(input)) out[k] = new Decimal(v);
  return out;
}

function makeContext(
  htft: Record<string, number>,
  options: {
    competitionCode?: string;
    htftCalibrated?: boolean;
    odds?: FullOddsSnapshot;
  } = {},
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
      htft: toDecimalMap({ ...ALL_ZERO_HTFT, ...htft }),
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
      htftCalibrated: options.htftCalibrated ?? true,
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

describe('decideHalfTimeFullTime (pure)', () => {
  it('is REJECTED market_suspended when the league is not HT/FT-calibrated', () => {
    const decision = decideHalfTimeFullTime(
      makeContext(
        { HOME_HOME: 0.3 },
        {
          htftCalibrated: false,
          odds: { ...BASE_ODDS, htftOdds: { HOME_HOME: new Decimal('3.00') } },
        },
      ),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('market_suspended');
  });

  it('returns REJECTED no_priced_pick when the book prices no HT/FT combo', () => {
    const decision = decideHalfTimeFullTime(makeContext({ HOME_HOME: 0.3 }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('no_priced_pick');
  });

  it('emits the most likely priced combo, ignoring a longshot with fat EV', () => {
    // HOME_HOME is the modal combo; AWAY_AWAY is a fat-tail longshot priced
    // at huge odds — an argmax-EV rule would grab it, the prediction channel
    // must still pick the most probable combo.
    const decision = decideHalfTimeFullTime(
      makeContext(
        { HOME_HOME: 0.3, AWAY_AWAY: 0.01 },
        {
          odds: {
            ...BASE_ODDS,
            htftOdds: {
              HOME_HOME: new Decimal('3.30'), // fair-ish → EV small
              AWAY_AWAY: new Decimal('300'), // absurd value on a noise cell
            },
          },
        },
      ),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.HALF_TIME_FULL_TIME);
    expect(decision.selections[0].pick).toBe('HOME_HOME');
  });

  it('returns REJECTED below_conviction when even the modal combo is too unlikely', () => {
    const decision = decideHalfTimeFullTime(
      makeContext(
        { AWAY_AWAY: 0.05 },
        { odds: { ...BASE_ODDS, htftOdds: { AWAY_AWAY: new Decimal('20') } } },
      ),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_conviction');
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const decision = decideHalfTimeFullTime(
      makeContext(
        { HOME_HOME: 0.3 },
        {
          odds: { ...BASE_ODDS, htftOdds: { HOME_HOME: new Decimal('3.30') } },
        },
      ),
    );
    const sel = decision.selections[0];
    expect(sel.odds?.toNumber()).toBe(3.3);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.3 * 3.3 - 1, 10);
  });
});

describe('HalfTimeFullTimeStrategy (class, prod config)', () => {
  const strategy = new HalfTimeFullTimeStrategy();

  it('allowedMarkets contains HALF_TIME_FULL_TIME', () => {
    expect(strategy.allowedMarkets).toEqual([Market.HALF_TIME_FULL_TIME]);
  });
});
