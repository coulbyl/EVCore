import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import {
  OverUnderHtStrategy,
  decideOverUnderHt,
} from './over-under-ht.strategy';
import type { OverUnderHtLineConfig } from './channel-strategy.config';
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
  ouHT?: Record<string, number>;
};

function toDecimalMap(
  input: Record<string, number> | undefined,
): Record<string, Decimal> {
  const out: Record<string, Decimal> = {};
  for (const [k, v] of Object.entries(input ?? {})) out[k] = new Decimal(v);
  return out;
}

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
      ouHT: toDecimalMap(probs.ouHT),
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

const OVER_0_5: OverUnderHtLineConfig = {
  line: '0_5',
  side: 'OVER',
  threshold: 0.78,
  enabled: true,
};
const UNDER_1_5: OverUnderHtLineConfig = {
  line: '1_5',
  side: 'UNDER',
  threshold: 0.52,
  enabled: true,
};

describe('decideOverUnderHt (pure)', () => {
  it('returns DISABLED when no line configs are enabled', () => {
    const decision = decideOverUnderHt(
      makeContext({ ouHT: { OVER_0_5: 0.83 } }),
      [],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it('returns REJECTED below_threshold when the probability is under the threshold', () => {
    const decision = decideOverUnderHt(
      makeContext({ ouHT: { OVER_0_5: 0.7 } }),
      [OVER_0_5],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('selects OVER_0_5 when it clears the threshold', () => {
    const decision = decideOverUnderHt(
      makeContext({ ouHT: { OVER_0_5: 0.83 } }),
      [OVER_0_5],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.OVER_UNDER_HT);
    expect(decision.selections[0].pick).toBe('OVER_0_5');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.83);
  });

  it('selects UNDER_1_5 when its config is enabled', () => {
    const decision = decideOverUnderHt(
      makeContext({ ouHT: { UNDER_1_5: 0.57 } }),
      [UNDER_1_5],
    );
    expect(decision.selections[0].market).toBe(Market.OVER_UNDER_HT);
    expect(decision.selections[0].pick).toBe('UNDER_1_5');
  });

  it('skips a config whose probability is missing from the context', () => {
    const decision = decideOverUnderHt(makeContext({}), [OVER_0_5]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(
      { ouHT: { OVER_0_5: 0.83 } },
      {
        odds: {
          ...BASE_ODDS,
          ouHtOdds: { OVER_0_5: new Decimal('1.15') },
        },
      },
    );
    const sel = decideOverUnderHt(ctx, [OVER_0_5]).selections[0];
    expect(sel.odds?.toNumber()).toBe(1.15);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.83 * 1.15 - 1, 10);
  });

  it('among qualifying candidates across both lines, picks the highest EV', () => {
    const ctx = makeContext(
      { ouHT: { OVER_0_5: 0.8, UNDER_1_5: 0.55 } },
      {
        odds: {
          ...BASE_ODDS,
          ouHtOdds: {
            OVER_0_5: new Decimal('1.15'),
            UNDER_1_5: new Decimal('1.90'),
          },
        },
      },
    );
    const decision = decideOverUnderHt(ctx, [OVER_0_5, UNDER_1_5]);
    // OVER_0_5: 0.8*1.15-1=-0.08, UNDER_1_5: 0.55*1.9-1=0.045
    expect(decision.selections[0].pick).toBe('UNDER_1_5');
  });
});

describe('OverUnderHtStrategy (class, prod config)', () => {
  const strategy = new OverUnderHtStrategy();

  // CSL has an ouHt shrinkage block (base05=0.83 -> OVER threshold 0.78,
  // base15=0.43 -> UNDER threshold 0.52, see OU_SHRINKAGE_CONFIG.CSL).
  it('is SELECTED for a league with an ouHt shrinkage block and a clearing pick', () => {
    expect(
      strategy.evaluate(
        makeContext({ ouHT: { OVER_0_5: 0.85 } }, { competitionCode: 'CSL' }),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it('is DISABLED for a league with no ouHt shrinkage block', () => {
    expect(
      strategy.evaluate(
        makeContext(
          { ouHT: { OVER_0_5: 0.9 } },
          { competitionCode: 'UNKNOWN_LEAGUE' },
        ),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('allowedMarkets contains OVER_UNDER_HT', () => {
    expect(strategy.allowedMarkets).toEqual([Market.OVER_UNDER_HT]);
  });
});
