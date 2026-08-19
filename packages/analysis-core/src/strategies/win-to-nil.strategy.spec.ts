import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import { WinToNilStrategy, decideWinToNil } from "./win-to-nil.strategy";
import type { ChannelStrategyLeagueConfig } from "./channel-strategy-config.types";
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

function makeContext(
  winToNilHome: number,
  winToNilAway: number,
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
      winToNilHome: new Decimal(winToNilHome),
      winToNilAway: new Decimal(winToNilAway),
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

const ENABLED: ChannelStrategyLeagueConfig = {
  enabled: true,
  threshold: 0.2,
  minSampleN: 20,
};

describe("decideWinToNil (pure)", () => {
  it("returns DISABLED when the config is disabled", () => {
    const decision = decideWinToNil(makeContext(0.3, 0.15), {
      enabled: false,
      threshold: 0.2,
      minSampleN: 20,
    });
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it("returns REJECTED below_threshold when neither side clears the threshold", () => {
    const decision = decideWinToNil(makeContext(0.15, 0.1), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("selects HOME when only winToNilHome clears the threshold", () => {
    const decision = decideWinToNil(makeContext(0.3, 0.1), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.WIN_TO_NIL_HOME);
    expect(decision.selections[0]!.pick).toBe("YES");
    expect(decision.selections[0]!.probability.toNumber()).toBeCloseTo(0.3);
  });

  it("prefers the more confident side when both clear the threshold", () => {
    const decision = decideWinToNil(makeContext(0.22, 0.3), ENABLED);
    expect(decision.selections[0]!.market).toBe(Market.WIN_TO_NIL_AWAY);
  });

  it("selects at exactly the threshold (boundary — lessThan, not lte)", () => {
    const decision = decideWinToNil(makeContext(0.2, 0.05), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it("attaches odds, implied probability and EV when the book has a price", () => {
    const ctx = makeContext(0.3, 0.1, {
      odds: {
        ...BASE_ODDS,
        winToNilHomeOdds: { yes: new Decimal("3.20"), no: new Decimal("1.35") },
      },
    });
    const sel = decideWinToNil(ctx, ENABLED).selections[0]!;
    expect(sel.odds?.toNumber()).toBe(3.2);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.3 * 3.2 - 1, 10);
  });

  it("records a price-less selection when no win-to-nil odds exist", () => {
    const sel = decideWinToNil(makeContext(0.3, 0.1), ENABLED).selections[0]!;
    expect(sel.odds).toBeUndefined();
    expect(sel.ev).toBeUndefined();
  });
});

describe("WinToNilStrategy (class, prod config)", () => {
  const strategy = new WinToNilStrategy();

  // ARG1 has a config entry (WTN home base 0.2914, threshold 0.24, derived
  // from settled fixtures — see WIN_TO_NIL_CONFIG.ARG1).
  it("is SELECTED for a league with a config and a clearing pick", () => {
    expect(
      strategy.evaluate(makeContext(0.3, 0.15, { competitionCode: "ARG1" }))
        .status,
    ).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it("is DISABLED for a league with no derived config", () => {
    expect(
      strategy.evaluate(
        makeContext(0.3, 0.15, { competitionCode: "UNKNOWN_LEAGUE" }),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it("allowedMarkets contains WIN_TO_NIL_HOME and WIN_TO_NIL_AWAY", () => {
    expect(strategy.allowedMarkets).toEqual([
      Market.WIN_TO_NIL_HOME,
      Market.WIN_TO_NIL_AWAY,
    ]);
  });
});
