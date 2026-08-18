import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import { ResultBttsStrategy, decideResultBtts } from "./result-btts.strategy";
import type { ResultBttsPickConfig } from "./config";
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
  resultBtts?: Record<string, number>;
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
      resultBtts: toDecimalMap(probs.resultBtts),
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

const HOME_YES: ResultBttsPickConfig = {
  side: "HOME",
  outcome: "YES",
  threshold: 0.12,
  enabled: true,
  minSampleN: 100,
};
const AWAY_NO: ResultBttsPickConfig = {
  side: "AWAY",
  outcome: "NO",
  threshold: 0.14,
  enabled: true,
  minSampleN: 100,
};

describe("decideResultBtts (pure)", () => {
  it("returns DISABLED when no pick configs are enabled", () => {
    const decision = decideResultBtts(
      makeContext({ resultBtts: { HOME_YES: 0.2 } }),
      [],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it("returns REJECTED below_threshold when the joint probability is under the threshold", () => {
    const decision = decideResultBtts(
      makeContext({ resultBtts: { HOME_YES: 0.08 } }),
      [HOME_YES],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("selects HOME_YES when it clears the threshold", () => {
    const decision = decideResultBtts(
      makeContext({ resultBtts: { HOME_YES: 0.2 } }),
      [HOME_YES],
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.RESULT_BTTS);
    expect(decision.selections[0]!.pick).toBe("HOME_YES");
    expect(decision.selections[0]!.probability.toNumber()).toBeCloseTo(0.2);
  });

  it("skips a config whose probability is missing from the context", () => {
    const decision = decideResultBtts(makeContext({}), [HOME_YES]);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("attaches odds, implied probability and EV when the book has a price", () => {
    const ctx = makeContext(
      { resultBtts: { HOME_YES: 0.2 } },
      {
        odds: {
          ...BASE_ODDS,
          resultBttsOdds: { HOME_YES: new Decimal("6.00") },
        },
      },
    );
    const sel = decideResultBtts(ctx, [HOME_YES]).selections[0]!;
    expect(sel.odds?.toNumber()).toBe(6);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.2 * 6 - 1, 10);
  });

  it("among qualifying candidates across both configs, picks the highest EV", () => {
    const ctx = makeContext(
      { resultBtts: { HOME_YES: 0.2, AWAY_NO: 0.16 } },
      {
        odds: {
          ...BASE_ODDS,
          resultBttsOdds: {
            HOME_YES: new Decimal("4.00"),
            AWAY_NO: new Decimal("7.00"),
          },
        },
      },
    );
    const decision = decideResultBtts(ctx, [HOME_YES, AWAY_NO]);
    // HOME_YES: 0.2*4-1=-0.2, AWAY_NO: 0.16*7-1=0.12
    expect(decision.selections[0]!.pick).toBe("AWAY_NO");
  });
});

describe("ResultBttsStrategy (class, prod config)", () => {
  const strategy = new ResultBttsStrategy();

  // ARG1 HOME_YES has a config entry (base 0.1410, threshold 0.1198, derived
  // from settled fixtures, see RESULT_BTTS_CONFIG.ARG1) — 0.2 clears it.
  it("is SELECTED for a league with a config and a clearing pick", () => {
    expect(
      strategy.evaluate(
        makeContext(
          { resultBtts: { HOME_YES: 0.2 } },
          { competitionCode: "ARG1" },
        ),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it("is DISABLED for a league with no config", () => {
    expect(
      strategy.evaluate(
        makeContext(
          { resultBtts: { HOME_YES: 0.9 } },
          { competitionCode: "UNKNOWN_LEAGUE" },
        ),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it("allowedMarkets contains RESULT_BTTS", () => {
    expect(strategy.allowedMarkets).toEqual([Market.RESULT_BTTS]);
  });
});
