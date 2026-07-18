import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { CleanSheetStrategy, decideCleanSheet } from './clean-sheet.strategy';
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
  cleanSheetHome: number,
  cleanSheetAway: number,
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
      cleanSheetHome: new Decimal(cleanSheetHome),
      cleanSheetAway: new Decimal(cleanSheetAway),
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
  threshold: 0.5,
  minSampleN: 20,
};

describe('decideCleanSheet (pure)', () => {
  it('returns DISABLED when the config is disabled', () => {
    const decision = decideCleanSheet(makeContext(0.6, 0.2), {
      enabled: false,
      threshold: 0.5,
      minSampleN: 20,
    });
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it('returns REJECTED below_threshold when neither side clears the threshold', () => {
    const decision = decideCleanSheet(makeContext(0.3, 0.2), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('selects HOME when only cleanSheetHome clears the threshold', () => {
    const decision = decideCleanSheet(makeContext(0.6, 0.2), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.CLEAN_SHEET_HOME);
    expect(decision.selections[0].pick).toBe('YES');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.6);
  });

  it('prefers the more confident side when both clear the threshold', () => {
    const decision = decideCleanSheet(makeContext(0.55, 0.62), ENABLED);
    expect(decision.selections[0].market).toBe(Market.CLEAN_SHEET_AWAY);
  });

  it('selects at exactly the threshold (boundary — lessThan, not lte)', () => {
    const decision = decideCleanSheet(makeContext(0.5, 0.1), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(0.6, 0.2, {
      odds: {
        ...BASE_ODDS,
        cleanSheetHomeOdds: {
          yes: new Decimal('1.90'),
          no: new Decimal('1.90'),
        },
      },
    });
    const sel = decideCleanSheet(ctx, ENABLED).selections[0];
    expect(sel.odds?.toNumber()).toBe(1.9);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.6 * 1.9 - 1, 10);
  });

  it('records a price-less selection when no clean sheet odds exist', () => {
    const sel = decideCleanSheet(makeContext(0.6, 0.2), ENABLED).selections[0];
    expect(sel.odds).toBeUndefined();
    expect(sel.ev).toBeUndefined();
  });
});

describe('CleanSheetStrategy (class, prod config)', () => {
  const strategy = new CleanSheetStrategy();

  it('is DISABLED for every league (no backtest yet)', () => {
    expect(
      strategy.evaluate(makeContext(0.7, 0.7, { competitionCode: 'BL1' }))
        .status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('allowedMarkets contains CLEAN_SHEET_HOME and CLEAN_SHEET_AWAY', () => {
    expect(strategy.allowedMarkets).toEqual([
      Market.CLEAN_SHEET_HOME,
      Market.CLEAN_SHEET_AWAY,
    ]);
  });
});
