import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market, CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import type { StrategyChannel } from "../types";
import { ValueStrategy } from "./value.strategy";
import type { StrategyContext, StrategyDecision } from "./types";
import type { FullOddsSnapshot, MatchProbabilities } from "../selection/types";

const BASE_PROBS = {
  home: new Decimal("0.55"),
  draw: new Decimal("0.25"),
  away: new Decimal("0.20"),
  bttsYes: new Decimal("0.50"),
  bttsNo: new Decimal("0.50"),
} as unknown as MatchProbabilities;

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

// VALUE (Phase 2, since 2026-08-18) no longer scans evaluatedMarkets — it
// filters the SELECTED picks Phase-1 market specialists already vetted.
// Tests build previousDecisions directly instead of evaluatedMarkets: one
// fake Phase-1 channel decision per candidate pick.
type CandidatePick = {
  channel?: StrategyChannel;
  market: Market;
  pick: string;
  probability: Decimal;
  odds: Decimal;
  ev: Decimal;
};

function makeCandidate(overrides: Partial<CandidatePick> = {}): CandidatePick {
  // Default edge = 0.68 − 1/1.80 = 0.124, comfortably above VALUE_MIN_EDGE (0.10).
  return {
    channel: STRATEGY_CHANNEL.DOMINANT,
    market: Market.ONE_X_TWO,
    pick: "HOME",
    probability: new Decimal("0.68"),
    odds: new Decimal("1.80"),
    ev: new Decimal("0.22"),
    ...overrides,
  };
}

function previousDecisionsFrom(
  candidates: CandidatePick[],
): Map<StrategyChannel, StrategyDecision> {
  const map = new Map<StrategyChannel, StrategyDecision>();
  // Distinct channel per candidate by default (a real Phase-1 channel emits
  // exactly one SELECTED decision) — tests that need several candidates on
  // the same channel key pass explicit distinct `channel` overrides.
  candidates.forEach((c, i) => {
    const channel = c.channel ?? (`FAKE_${i}` as StrategyChannel);
    map.set(channel, {
      channel,
      status: CHANNEL_DECISION_STATUS.SELECTED,
      selections: [
        {
          market: c.market,
          pick: c.pick,
          probability: c.probability,
          odds: c.odds,
          ev: c.ev,
          rank: 1,
        },
      ],
    });
  });
  return map;
}

function makeContext(
  overrides: Partial<StrategyContext> = {},
): StrategyContext {
  return {
    fixture: {
      id: "f1",
      homeTeamId: "h1",
      awayTeamId: "a1",
      scheduledAt: new Date(),
    },
    competitionCode: "PL",
    sport: "FOOTBALL",
    phase: "PRE_KICKOFF",
    deterministicScore: new Decimal("0.65"),
    probabilities: BASE_PROBS,
    evaluatedMarkets: [],
    odds: BASE_ODDS,
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
    modelScoreThreshold: new Decimal("0.60"),
    previousDecisions: new Map(),
    ...overrides,
  };
}

describe("ValueStrategy", () => {
  const strategy = new ValueStrategy();

  it("returns MISSING_ODDS when odds is null", () => {
    const ctx = makeContext({ odds: null });
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.MISSING_ODDS,
    );
  });

  it("returns REJECTED with score_below_threshold when score < 0.60", () => {
    const ctx = makeContext({ deterministicScore: new Decimal("0.55") });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("score_below_threshold");
    expect(decision.selections).toHaveLength(0);
  });

  it("returns REJECTED with no_viable_pick when no Phase-1 channel selected anything", () => {
    const decision = strategy.evaluate(
      makeContext({ previousDecisions: new Map() }),
    );
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("no_viable_pick");
  });

  it("ignores a REJECTED Phase-1 decision — no candidate contributed", () => {
    const previousDecisions = new Map<StrategyChannel, StrategyDecision>([
      [
        STRATEGY_CHANNEL.DOMINANT,
        {
          channel: STRATEGY_CHANNEL.DOMINANT,
          status: CHANNEL_DECISION_STATUS.REJECTED,
          reasonCode: "below_threshold",
          selections: [],
        },
      ],
    ]);
    const decision = strategy.evaluate(makeContext({ previousDecisions }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("no_viable_pick");
  });

  it("returns SELECTED with the best viable pick", () => {
    const previousDecisions = previousDecisionsFrom([makeCandidate()]);
    const decision = strategy.evaluate(makeContext({ previousDecisions }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections).toHaveLength(1);
    expect(decision.selections[0]!.market).toBe(Market.ONE_X_TWO);
    expect(decision.selections[0]!.pick).toBe("HOME");
    expect(decision.selections[0]!.rank).toBe(1);
  });

  it("picks the best edge among several Phase-1 channels on different markets", () => {
    const strongerEdge = makeCandidate({
      channel: STRATEGY_CHANNEL.GOALS,
      market: Market.OVER_UNDER,
      pick: "OVER",
      probability: new Decimal("0.75"),
      odds: new Decimal("1.80"),
      ev: new Decimal("0.35"),
    });
    const previousDecisions = previousDecisionsFrom([
      makeCandidate(),
      strongerEdge,
    ]);
    const decision = strategy.evaluate(makeContext({ previousDecisions }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.OVER_UNDER);
    expect(decision.selections[0]!.pick).toBe("OVER");
  });

  it("discounts a market's qualityScore by marketTrust before ranking, so a lower-quality but more trusted market can win", () => {
    // Without trust, OVER_UNDER (higher edge/EV) would win — see the test
    // above. A near-zero trust on OVER_UNDER flips the winner to ONE_X_TWO.
    const strongerEdgeUntrusted = makeCandidate({
      channel: STRATEGY_CHANNEL.GOALS,
      market: Market.OVER_UNDER,
      pick: "OVER",
      probability: new Decimal("0.75"),
      odds: new Decimal("1.80"),
      ev: new Decimal("0.35"),
    });
    const previousDecisions = previousDecisionsFrom([
      makeCandidate(), // ONE_X_TWO/HOME, default candidate
      strongerEdgeUntrusted,
    ]);
    const base = makeContext({ previousDecisions });
    const decision = strategy.evaluate({
      ...base,
      selectionConfig: {
        ...base.selectionConfig,
        valueMarketTrust: (market) =>
          market === Market.OVER_UNDER ? new Decimal("0.05") : new Decimal(1),
      },
    });
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    expect(decision.selections[0]!.market).toBe(Market.ONE_X_TWO);
  });

  it("returns REJECTED with line_movement when movement > 0.10", () => {
    const previousDecisions = previousDecisionsFrom([makeCandidate()]);
    const ctx = makeContext({
      previousDecisions,
      signals: {
        suspendedMarkets: new Set(),
        lambdaFloorHit: false,
        lambdaTotal: 2.5,
        lineMovement: 0.15,
        h2h: null,
        congestion: null,
      },
    });
    const decision = strategy.evaluate(ctx);
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("line_movement");
  });

  it("does not reject when line_movement is exactly at threshold (0.10)", () => {
    const previousDecisions = previousDecisionsFrom([makeCandidate()]);
    const ctx = makeContext({
      previousDecisions,
      signals: {
        suspendedMarkets: new Set(),
        lambdaFloorHit: false,
        lambdaTotal: 2.5,
        lineMovement: 0.1,
        h2h: null,
        congestion: null,
      },
    });
    // threshold is exclusive (> not >=)
    expect(strategy.evaluate(ctx).status).toBe(
      CHANNEL_DECISION_STATUS.SELECTED,
    );
  });

  it("rejects a positive-EV pick whose edge is below VALUE_MIN_EDGE (0.10)", () => {
    // prob 0.62 @ 1.80 → EV +0.116 (positive) but edge = 0.62 − 0.556 = 0.064 < 0.10.
    const lowEdge = makeCandidate({
      probability: new Decimal("0.62"),
      ev: new Decimal("0.116"),
    });
    const previousDecisions = previousDecisionsFrom([lowEdge]);
    const decision = strategy.evaluate(makeContext({ previousDecisions }));
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("no_viable_pick");
  });

  it("suspends VALUE when the league config sets an unreachable edge floor", () => {
    const previousDecisions = previousDecisionsFrom([makeCandidate()]); // edge 0.124 — would normally be selected
    const base = makeContext({ previousDecisions });
    const decision = strategy.evaluate({
      ...base,
      selectionConfig: {
        ...base.selectionConfig,
        valueMinEdge: new Decimal("1"),
      },
    });
    expect(decision.status).toBe(CHANNEL_DECISION_STATUS.REJECTED);
    expect(decision.reasonCode).toBe("no_viable_pick");
  });

  it("enforces allowedMarkets — every market listEvaluatedPicks() can emit must be listed", () => {
    // The EV channel is transverse: it must allow every market
    // listEvaluatedPicks() (analysis-core/selection/pick-evaluation.ts) can
    // produce a candidate for, or the orchestrator rejects the selection at
    // runtime (production incident 2026-07-19: TEAM_TOTAL_HOME was wired into
    // listEvaluatedPicks but not into this list).
    const supported = [
      Market.ONE_X_TWO,
      Market.OVER_UNDER,
      Market.BTTS,
      Market.DOUBLE_CHANCE,
      Market.HALF_TIME_FULL_TIME,
      Market.OVER_UNDER_HT,
      Market.FIRST_HALF_WINNER,
      Market.DRAW_NO_BET,
      Market.TEAM_TOTAL_HOME,
      Market.TEAM_TOTAL_AWAY,
      Market.CLEAN_SHEET_HOME,
      Market.CLEAN_SHEET_AWAY,
      Market.WIN_TO_NIL_HOME,
      Market.WIN_TO_NIL_AWAY,
      Market.TO_WIN_EITHER_HALF,
      Market.RESULT_TOTAL_GOALS,
      Market.RESULT_BTTS,
    ];
    for (const market of supported) {
      expect(strategy.allowedMarkets).toContain(market);
    }
  });
});
