import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import { DrawNoBetStrategy, decideDrawNoBet } from "./draw-no-bet.strategy";
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
  dnbHome: number,
  dnbAway: number,
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
      dnbHome: new Decimal(dnbHome),
      dnbAway: new Decimal(dnbAway),
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
  threshold: 0.55,
  minSampleN: 50,
};

describe("decideDrawNoBet (pure)", () => {
  it("returns DISABLED when the config is disabled", () => {
    const decision = decideDrawNoBet(makeContext(0.6, 0.4), {
      enabled: false,
      threshold: 0.55,
      minSampleN: 50,
    });
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.DISABLED);
    expect(decision.selections).toHaveLength(0);
  });

  it("returns REJECTED below_threshold when neither side clears the threshold", () => {
    const decision = decideDrawNoBet(makeContext(0.52, 0.48), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("selects HOME when only dnbHome clears the threshold", () => {
    const decision = decideDrawNoBet(makeContext(0.6, 0.4), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.DRAW_NO_BET);
    expect(decision.selections[0]!.pick).toBe("HOME");
    expect(decision.selections[0]!.probability.toNumber()).toBeCloseTo(0.6);
  });

  it("selects AWAY when only dnbAway clears the threshold", () => {
    const decision = decideDrawNoBet(makeContext(0.4, 0.6), ENABLED);
    expect(decision.selections[0]!.pick).toBe("AWAY");
  });

  it("selects at exactly the threshold (boundary — lessThan, not lte)", () => {
    const decision = decideDrawNoBet(makeContext(0.55, 0.45), ENABLED);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it("attaches odds, implied probability and EV when the book has a price", () => {
    const ctx = makeContext(0.6, 0.4, {
      odds: {
        ...BASE_ODDS,
        drawNoBetOdds: { home: new Decimal("1.55"), away: new Decimal("2.60") },
      },
    });
    const sel = decideDrawNoBet(ctx, ENABLED).selections[0]!;
    expect(sel.odds?.toNumber()).toBe(1.55);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.6 * 1.55 - 1, 10);
  });

  it("records a price-less selection when no draw-no-bet odds exist", () => {
    const sel = decideDrawNoBet(makeContext(0.6, 0.4), ENABLED).selections[0]!;
    expect(sel.odds).toBeUndefined();
    expect(sel.ev).toBeUndefined();
  });
});

describe("DrawNoBetStrategy (class, prod config)", () => {
  const strategy = new DrawNoBetStrategy();

  // ARG1 has a config entry (home win rate among decisive matches 0.6327,
  // threshold 0.5827, derived from settled fixtures — see DRAW_NO_BET_CONFIG.ARG1).
  it("is SELECTED for a league with a config and a clearing pick", () => {
    expect(
      strategy.evaluate(makeContext(0.7, 0.3, { competitionCode: "ARG1" }))
        .status,
    ).toBe(CHANNEL_DECISION_STATUS.SELECTED);
  });

  it("is DISABLED for a league with no derived config", () => {
    expect(
      strategy.evaluate(
        makeContext(0.7, 0.3, { competitionCode: "UNKNOWN_LEAGUE" }),
      ).status,
    ).toBe(CHANNEL_DECISION_STATUS.DISABLED);
  });

  it("allowedMarkets contains DRAW_NO_BET", () => {
    expect(strategy.allowedMarkets).toEqual([Market.DRAW_NO_BET]);
  });
});
