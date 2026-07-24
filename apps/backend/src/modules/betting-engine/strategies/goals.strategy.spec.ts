import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { GoalsStrategy, decideGoals } from './goals.strategy';
import type { GoalsLineConfig } from './channel-strategy.config';
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

type ProbInput = {
  over15?: number;
  under15?: number;
  over25?: number;
  under25?: number;
  over35?: number;
  under35?: number;
  over45?: number;
  under45?: number;
};

function makeContext(
  probs: ProbInput,
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
      over15: new Decimal(probs.over15 ?? 0),
      under15: new Decimal(probs.under15 ?? 0),
      over25: new Decimal(probs.over25 ?? 0),
      under25: new Decimal(probs.under25 ?? 0),
      over35: new Decimal(probs.over35 ?? 0),
      under35: new Decimal(probs.under35 ?? 0),
      over45: new Decimal(probs.over45 ?? 0),
      under45: new Decimal(probs.under45 ?? 0),
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

const OVER_25: GoalsLineConfig = {
  line: 2.5,
  side: 'OVER',
  enabled: true,
  threshold: 0.55,
  minSampleN: 20,
};
const UNDER_25: GoalsLineConfig = {
  line: 2.5,
  side: 'UNDER',
  enabled: true,
  threshold: 0.55,
  minSampleN: 20,
};

describe('decideGoals (pure)', () => {
  it('returns DISABLED when no line configs are enabled', () => {
    const decision = decideGoals(makeContext({ over25: 0.7 }), []);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it('returns REJECTED below_threshold when the side probability is under the threshold', () => {
    const decision = decideGoals(makeContext({ over25: 0.5 }), [OVER_25]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
    expect(decision.reasonDetails).toMatchObject({
      probability: 0.5,
      threshold: 0.55,
    });
  });

  it('selects the OVER side when its probability clears the threshold', () => {
    const ctx = makeContext(
      { over25: 0.62 },
      { odds: { ...BASE_ODDS, overUnderOdds: { OVER: new Decimal('1.90') } } },
    );
    const decision = decideGoals(ctx, [OVER_25]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.OVER_UNDER);
    expect(decision.selections[0].pick).toBe('OVER');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.62);
    expect(decision.selections[0].rank).toBe(1);
  });

  it('selects at exactly the threshold (boundary — lessThan, not lte)', () => {
    const ctx = makeContext(
      { over25: 0.55 },
      { odds: { ...BASE_ODDS, overUnderOdds: { OVER: new Decimal('1.90') } } },
    );
    const decision = decideGoals(ctx, [OVER_25]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it('uses the correct pick string per line (3.5 → OVER_3_5)', () => {
    const cfg: GoalsLineConfig = { ...OVER_25, line: 3.5, threshold: 0.4 };
    const ctx = makeContext(
      { over35: 0.45 },
      {
        odds: {
          ...BASE_ODDS,
          overUnderOdds: { OVER_3_5: new Decimal('1.90') },
        },
      },
    );
    const decision = decideGoals(ctx, [cfg]);
    expect(decision.selections[0].pick).toBe('OVER_3_5');
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(
      { over25: 0.62 },
      { odds: { ...BASE_ODDS, overUnderOdds: { OVER: new Decimal('1.90') } } },
    );
    const sel = decideGoals(ctx, [OVER_25]).selections[0];
    expect(sel.odds?.toNumber()).toBe(1.9);
    expect(sel.impliedProbability?.toNumber()).toBeCloseTo(1 / 1.9, 10);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.62 * 1.9 - 1, 10);
  });

  it('rejects with no_priced_line when no above-threshold line has a book price', () => {
    // commit 4a10108: an unpriced candidate is never selected — falling back
    // to the highest-probability line flooded the feed with unactionable
    // picks (9147 GOALS UNDER_4.5 selections, 0.6% actually priced).
    const decision = decideGoals(makeContext({ over25: 0.62 }), [OVER_25]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('no_priced_line');
    expect(decision.selections).toHaveLength(0);
  });

  it('among qualifying candidates, picks the highest EV', () => {
    // Both sides qualify (thresholds low); OVER is priced richer → higher EV.
    const lowThreshold: GoalsLineConfig[] = [
      { ...OVER_25, threshold: 0.4 },
      { ...UNDER_25, threshold: 0.4 },
    ];
    const ctx = makeContext(
      { over25: 0.5, under25: 0.5 },
      {
        odds: {
          ...BASE_ODDS,
          overUnderOdds: {
            OVER: new Decimal('2.20'),
            UNDER: new Decimal('1.70'),
          },
        },
      },
    );
    const decision = decideGoals(ctx, lowThreshold);
    expect(decision.selections[0].pick).toBe('OVER'); // 0.5*2.2-1=0.10 > 0.5*1.7-1=-0.15
  });
});

describe('GoalsStrategy (class, prod config)', () => {
  const strategy = new GoalsStrategy();

  it('returns DISABLED for leagues with no GOALS config', () => {
    expect(
      strategy.evaluate(
        makeContext({ over25: 0.7 }, { competitionCode: 'UNKNOWN' }),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('evaluates enabled observation segments (BL1 OVER 2.5 @ 0.57)', () => {
    // GOALS is enabled in observation; over25 0.7 ≥ BL1 Over 2.5 gate 0.57, and
    // the other lines stay at 0 (below their gates) → SELECTED OVER once priced.
    const decision = strategy.evaluate(
      makeContext(
        { over25: 0.7 },
        {
          competitionCode: 'BL1',
          odds: {
            ...BASE_ODDS,
            overUnderOdds: { OVER: new Decimal('1.90') },
          },
        },
      ),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].pick).toBe('OVER');
  });

  it('allowedMarkets contains only OVER_UNDER', () => {
    expect(strategy.allowedMarkets).toEqual([Market.OVER_UNDER]);
  });
});
