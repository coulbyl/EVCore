import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market } from "../types";
import {
  FirstHalfWinnerStrategy,
  decideFirstHalfWinner,
} from "./first-half-winner.strategy";
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

function makeContext(opts: {
  home: number;
  draw: number;
  away: number;
  competitionCode?: string;
  htftCalibrated?: boolean;
  odds?: FullOddsSnapshot;
}): StrategyContext {
  const {
    home,
    draw,
    away,
    competitionCode = "SA",
    htftCalibrated = true,
    odds = BASE_ODDS,
  } = opts;
  return {
    fixture: {
      id: "f1",
      homeTeamId: "h1",
      awayTeamId: "a1",
      scheduledAt: new Date(),
    },
    competitionCode,
    sport: "FOOTBALL",
    phase: "PRE_KICKOFF",
    deterministicScore: new Decimal("0.65"),
    probabilities: {
      firstHalfWinner: {
        home: new Decimal(home),
        draw: new Decimal(draw),
        away: new Decimal(away),
      },
    } as unknown as MatchProbabilities,
    evaluatedMarkets: [],
    odds,
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
      htftCalibrated,
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

describe("decideFirstHalfWinner (pure)", () => {
  it("is REJECTED market_suspended when the league is not HT/FT-calibrated", () => {
    const ctx = makeContext({
      home: 0.3,
      draw: 0.45,
      away: 0.25,
      competitionCode: "SA",
      htftCalibrated: false,
    });
    const decision = decideFirstHalfWinner(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("market_suspended");
  });

  it("returns DISABLED for a league with no FIRST_HALF config", () => {
    const ctx = makeContext({
      home: 0.3,
      draw: 0.45,
      away: 0.25,
      competitionCode: "UNKNOWN_LEAGUE",
    });
    expect(decideFirstHalfWinner(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.DISABLED,
    );
  });

  // SA threshold = 0.38 (HT draw base rate 0.4284 - 0.05).
  it("returns REJECTED below_threshold when argmax probability < league threshold", () => {
    const ctx = makeContext({
      home: 0.3,
      draw: 0.35,
      away: 0.35,
      competitionCode: "SA",
    });
    const decision = decideFirstHalfWinner(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("below_threshold");
  });

  it("returns REJECTED insufficient_margin when argmax barely leads", () => {
    // SA threshold 0.38; 0.40 DRAW vs 0.38 HOME clears threshold but margin
    // (0.02) < FIRST_HALF_WINNER_MIN_MARGIN (0.05).
    const ctx = makeContext({
      home: 0.38,
      draw: 0.4,
      away: 0.22,
      competitionCode: "SA",
    });
    const decision = decideFirstHalfWinner(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("insufficient_margin");
  });

  it("selects DRAW when it is the clear HT argmax", () => {
    const ctx = makeContext({
      home: 0.3,
      draw: 0.5,
      away: 0.2,
      competitionCode: "SA",
    });
    const decision = decideFirstHalfWinner(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.FIRST_HALF_WINNER);
    expect(decision.selections[0]!.pick).toBe("DRAW");
  });

  it("selects HOME when it is the clear HT argmax", () => {
    const ctx = makeContext({
      home: 0.55,
      draw: 0.25,
      away: 0.2,
      competitionCode: "SA",
    });
    expect(decideFirstHalfWinner(ctx).selections[0]!.pick).toBe("HOME");
  });

  it("attaches odds, implied probability and EV when the book has a price", () => {
    const ctx = makeContext({
      home: 0.3,
      draw: 0.5,
      away: 0.2,
      competitionCode: "SA",
      odds: {
        ...BASE_ODDS,
        firstHalfWinnerOdds: {
          home: new Decimal("4.00"),
          draw: new Decimal("1.90"),
          away: new Decimal("5.50"),
        },
      },
    });
    const sel = decideFirstHalfWinner(ctx).selections[0]!;
    expect(sel.odds?.toNumber()).toBe(1.9);
    expect(sel.ev?.toNumber()).toBeCloseTo(0.5 * 1.9 - 1, 10);
  });
});

describe("FirstHalfWinnerStrategy (class, prod config)", () => {
  const strategy = new FirstHalfWinnerStrategy();

  it("allowedMarkets contains FIRST_HALF_WINNER", () => {
    expect(strategy.allowedMarkets).toEqual([Market.FIRST_HALF_WINNER]);
  });
});
