import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/analysis-core';
import { TeamTotalStrategy, decideTeamTotal } from './team-total.strategy';
import type { TeamTotalLineConfig } from './channel-strategy.config';
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
  teamTotalHome?: Record<string, number>;
  teamTotalAway?: Record<string, number>;
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
      teamTotalHome: toDecimalMap(probs.teamTotalHome),
      teamTotalAway: toDecimalMap(probs.teamTotalAway),
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

const HOME_OVER_1_5: TeamTotalLineConfig = {
  team: 'HOME',
  line: 1.5,
  side: 'OVER',
  enabled: true,
  threshold: 0.55,
  minSampleN: 20,
};
const AWAY_UNDER_1_5: TeamTotalLineConfig = {
  team: 'AWAY',
  line: 1.5,
  side: 'UNDER',
  enabled: true,
  threshold: 0.55,
  minSampleN: 20,
};

describe('decideTeamTotal (pure)', () => {
  it('returns DISABLED when no line configs are enabled', () => {
    const decision = decideTeamTotal(
      makeContext({ teamTotalHome: { OVER_1_5: 0.7 } }),
      [],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it('returns REJECTED below_threshold when the side probability is under the threshold', () => {
    const decision = decideTeamTotal(
      makeContext({ teamTotalHome: { OVER_1_5: 0.5 } }),
      [HOME_OVER_1_5],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('selects TEAM_TOTAL_HOME OVER_1_5 when it clears the threshold', () => {
    const decision = decideTeamTotal(
      makeContext({ teamTotalHome: { OVER_1_5: 0.62 } }),
      [HOME_OVER_1_5],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0].market).toBe(Market.TEAM_TOTAL_HOME);
    expect(decision.selections[0].pick).toBe('OVER_1_5');
    expect(decision.selections[0].probability.toNumber()).toBeCloseTo(0.62);
  });

  it('selects TEAM_TOTAL_AWAY when its config is enabled', () => {
    const decision = decideTeamTotal(
      makeContext({ teamTotalAway: { UNDER_1_5: 0.6 } }),
      [AWAY_UNDER_1_5],
    );
    expect(decision.selections[0].market).toBe(Market.TEAM_TOTAL_AWAY);
    expect(decision.selections[0].pick).toBe('UNDER_1_5');
  });

  it('skips a config whose probability is missing from the context', () => {
    // teamTotalHome has no OVER_1_5 entry at all (undefined, not just low).
    const decision = decideTeamTotal(makeContext({}), [HOME_OVER_1_5]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe('below_threshold');
  });

  it('attaches odds, implied probability and EV when the book has a price', () => {
    const ctx = makeContext(
      { teamTotalHome: { OVER_1_5: 0.62 } },
      {
        odds: {
          ...BASE_ODDS,
          teamTotalHomeOdds: { OVER_1_5: new Decimal('1.90') },
        },
      },
    );
    const sel = decideTeamTotal(ctx, [HOME_OVER_1_5]).selections[0];
    expect(sel.odds?.toNumber()).toBe(1.9);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.62 * 1.9 - 1, 10);
  });

  it('among qualifying candidates across both teams, picks the highest EV', () => {
    const lowThreshold: TeamTotalLineConfig[] = [
      { ...HOME_OVER_1_5, threshold: 0.4 },
      { ...AWAY_UNDER_1_5, threshold: 0.4 },
    ];
    const ctx = makeContext(
      {
        teamTotalHome: { OVER_1_5: 0.5 },
        teamTotalAway: { UNDER_1_5: 0.5 },
      },
      {
        odds: {
          ...BASE_ODDS,
          teamTotalHomeOdds: { OVER_1_5: new Decimal('2.20') },
          teamTotalAwayOdds: { UNDER_1_5: new Decimal('1.70') },
        },
      },
    );
    const decision = decideTeamTotal(ctx, lowThreshold);
    expect(decision.selections[0].market).toBe(Market.TEAM_TOTAL_HOME); // 0.5*2.2-1=0.10 > 0.5*1.7-1=-0.15
  });
});

describe('TeamTotalStrategy (class, prod config)', () => {
  const strategy = new TeamTotalStrategy();

  it('is DISABLED for every league (no backtest yet)', () => {
    expect(
      strategy.evaluate(
        makeContext(
          { teamTotalHome: { OVER_1_5: 0.9 } },
          { competitionCode: 'BL1' },
        ),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it('allowedMarkets contains TEAM_TOTAL_HOME and TEAM_TOTAL_AWAY', () => {
    expect(strategy.allowedMarkets).toEqual([
      Market.TEAM_TOTAL_HOME,
      Market.TEAM_TOTAL_AWAY,
    ]);
  });
});
