import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import {
  ResultTotalGoalsStrategy,
  decideResultTotalGoals,
} from "./result-total-goals.strategy";
import type { ResultTotalGoalsLineConfig } from "./config";
import { CHANNEL_DECISION_STATUS } from "../types";
import type { StrategyContext } from "./types";
import type { FullOddsSnapshot, MatchProbabilities } from "../selection/types";

const BASE_ODDS: FullOddsSnapshot = {
  bookmaker: "Pinnacle",
  snapshotAt: new Date(),
  homeOdds: new Decimal("1.80"),
  drawOdds: new Decimal("3.50"),
  awayOdds: new Decimal("4.50"),
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
  resultTotalGoals?: Record<string, number>;
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
      id: "f1",
      homeTeamId: "h1",
      awayTeamId: "a1",
      scheduledAt: new Date(),
    },
    competitionCode: options.competitionCode ?? "BL1",
    sport: "FOOTBALL",
    phase: "PRE_KICKOFF",
    deterministicScore: new Decimal("0.65"),
    probabilities: {
      resultTotalGoals: toDecimalMap(probs.resultTotalGoals),
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
      leagueEvThreshold: new Decimal("0.08"),
      svMinProbability: new Decimal("0.68"),
      svMinOdds: new Decimal("1.15"),
      htftCalibrated: false,
      pickDirectionProbabilityThreshold: () => new Decimal("0"),
      pickEvFloor: (_m: unknown, _p: unknown, leagueFloor: Decimal) =>
        leagueFloor,
      pickEvSoftCap: () => new Decimal("0.90"),
      pickMinSelectionOdds: () => new Decimal("1.15"),
      pickMaxSelectionOdds: () => null,
    },
    modelScoreThreshold: new Decimal("0.5"),
    previousDecisions: new Map(),
  };
}

const HOME_UNDER_2_5: ResultTotalGoalsLineConfig = {
  side: "HOME",
  line: "2_5",
  threshold: 0.2,
  enabled: true,
};
const AWAY_UNDER_1_5: ResultTotalGoalsLineConfig = {
  side: "AWAY",
  line: "1_5",
  threshold: 0.1,
  enabled: true,
};

describe("decideResultTotalGoals (pure)", () => {
  it("returns DISABLED when no line configs are enabled", () => {
    const decision = decideResultTotalGoals(
      makeContext({ resultTotalGoals: { HOME_UNDER_2_5: 0.25 } }),
      [],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it("returns REJECTED below_threshold when the joint probability is under the threshold", () => {
    const decision = decideResultTotalGoals(
      makeContext({ resultTotalGoals: { HOME_UNDER_2_5: 0.15 } }),
      [HOME_UNDER_2_5],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("selects HOME_UNDER_2_5 when it clears the threshold", () => {
    const decision = decideResultTotalGoals(
      makeContext({ resultTotalGoals: { HOME_UNDER_2_5: 0.25 } }),
      [HOME_UNDER_2_5],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.RESULT_TOTAL_GOALS);
    expect(decision.selections[0]!.pick).toBe("HOME_UNDER_2_5");
    expect(decision.selections[0]!.probability.toNumber()).toBeCloseTo(0.25);
  });

  it("skips a config whose probability is missing from the context", () => {
    const decision = decideResultTotalGoals(makeContext({}), [HOME_UNDER_2_5]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("attaches odds, implied probability and EV when the book has a price", () => {
    const ctx = makeContext(
      { resultTotalGoals: { HOME_UNDER_2_5: 0.25 } },
      {
        odds: {
          ...BASE_ODDS,
          resultTotalGoalsOdds: { HOME_UNDER_2_5: new Decimal("4.20") },
        },
      },
    );
    const sel = decideResultTotalGoals(ctx, [HOME_UNDER_2_5]).selections[0]!;
    expect(sel.odds?.toNumber()).toBe(4.2);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.25 * 4.2 - 1, 10);
  });

  it("among qualifying candidates across both configs, picks the highest EV", () => {
    const ctx = makeContext(
      {
        resultTotalGoals: {
          HOME_UNDER_2_5: 0.25,
          AWAY_UNDER_1_5: 0.12,
        },
      },
      {
        odds: {
          ...BASE_ODDS,
          resultTotalGoalsOdds: {
            HOME_UNDER_2_5: new Decimal("3.00"),
            AWAY_UNDER_1_5: new Decimal("9.00"),
          },
        },
      },
    );
    const decision = decideResultTotalGoals(ctx, [
      HOME_UNDER_2_5,
      AWAY_UNDER_1_5,
    ]);
    // HOME: 0.25*3-1=-0.25, AWAY: 0.12*9-1=0.08
    expect(decision.selections[0]!.pick).toBe("AWAY_UNDER_1_5");
  });
});

describe("ResultTotalGoalsStrategy (class, prod config)", () => {
  const strategy = new ResultTotalGoalsStrategy();

  // ARG2 HOME 1_5 has a resultTotalGoals shrinkage entry (base 0.175,
  // threshold 0.175*0.85≈0.149, see OU_SHRINKAGE_CONFIG.ARG2) — 0.20 clears it.
  it("is SELECTED for a league with a resultTotalGoals shrinkage block and a clearing pick", () => {
    expect(
      strategy.evaluate(
        makeContext(
          { resultTotalGoals: { HOME_UNDER_1_5: 0.2 } },
          { competitionCode: "ARG2" },
        ),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it("is DISABLED for a league with no resultTotalGoals shrinkage block", () => {
    expect(
      strategy.evaluate(
        makeContext(
          { resultTotalGoals: { HOME_UNDER_1_5: 0.9 } },
          { competitionCode: "UNKNOWN_LEAGUE" },
        ),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it("allowedMarkets contains RESULT_TOTAL_GOALS", () => {
    expect(strategy.allowedMarkets).toEqual([Market.RESULT_TOTAL_GOALS]);
  });
});
