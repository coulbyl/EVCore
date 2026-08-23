import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Market, CHANNEL_DECISION_STATUS, STRATEGY_CHANNEL } from "../types";
import type { StrategyChannel } from "../types";
import { ChannelStrategyOrchestrator } from "./orchestrator";
import { createChannelStrategyOrchestrator, V1_STRATEGIES } from "./registry";
import type {
  ChannelStrategy,
  StrategyContext,
  StrategyDecision,
} from "./types";
import type { FullOddsSnapshot, MatchProbabilities } from "../selection/types";

const BASE_ODDS: FullOddsSnapshot = {
  bookmaker: "Pinnacle",
  snapshotAt: new Date(),
  homeOdds: new Decimal("1.90"),
  drawOdds: new Decimal("3.30"), // implied 0.303 ≥ BL1 DRAW threshold 0.28
  awayOdds: new Decimal("4.50"),
  // BL1's GOALS config only enables 1.5 OVER (thr .78), 2.5 OVER (thr .45),
  // 3.5 UNDER (thr .53) — under35=0.82 below clears 3.5 UNDER, priced here so
  // GOALS can actually select it (an unpriced line is never selected — see
  // goals.strategy.ts).
  overUnderOdds: { UNDER_3_5: new Decimal("1.30") },
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
  overrides: Partial<StrategyContext> = {},
): StrategyContext {
  return {
    fixture: {
      id: "f1",
      homeTeamId: "h1",
      awayTeamId: "a1",
      scheduledAt: new Date(),
    },
    competitionCode: "BL1",
    sport: "FOOTBALL",
    phase: "PRE_KICKOFF",
    deterministicScore: new Decimal("0.80"),
    probabilities: {
      // home=0.65 so DOMINANT clears its margin AND VALUE clears its edge
      // floor from DOMINANT's own priced selection (0.65 - 1/1.90 = 0.126 ≥
      // VALUE_MIN_EDGE 0.10) — VALUE/SAFE no longer read evaluatedMarkets
      // (moved to Phase 2, filtering Phase-1 SELECTED decisions instead,
      // 2026-08-18), so every candidate here must come from what a market
      // specialist naturally derives from these probabilities + BASE_ODDS.
      home: new Decimal("0.65"),
      draw: new Decimal("0.20"),
      away: new Decimal("0.15"),
      bttsYes: new Decimal("0.65"), // ≥ BL1 BTTS threshold 0.60
      bttsNo: new Decimal("0.35"),
      over15: new Decimal("0.74"),
      under15: new Decimal("0.26"),
      over25: new Decimal("0.40"),
      under25: new Decimal("0.60"),
      over35: new Decimal("0.18"),
      under35: new Decimal("0.82"),
      over45: new Decimal("0.07"),
      under45: new Decimal("0.93"),
      cleanSheetHome: new Decimal("0.30"),
      cleanSheetAway: new Decimal("0.20"),
      winEitherHalfHome: new Decimal("0.55"),
      winEitherHalfAway: new Decimal("0.45"),
      teamTotalHome: {},
      teamTotalAway: {},
      ouHT: {},
      resultTotalGoals: {},
      resultBtts: {},
      // Below BL1's DRAW_NO_BET_CONFIG threshold (0.5125) so DRAW_NO_BET is
      // REJECTED here, not exercised beyond the probability read.
      dnbHome: new Decimal("0.5"),
      dnbAway: new Decimal("0.35"),
      // Below BL1's WIN_TO_NIL_CONFIG threshold (0.15) so WIN_TO_NIL is
      // REJECTED here, not exercised beyond the probability read.
      winToNilHome: new Decimal("0.1"),
      winToNilAway: new Decimal("0.08"),
      // Below DOUBLE_CHANCE_CONFIG.minProbability (0.75) so DOUBLE_CHANCE is
      // REJECTED here, not exercised beyond the probability read.
      dc1X: new Decimal("0.5"),
      dcX2: new Decimal("0.5"),
      dc12: new Decimal("0.5"),
      // htftCalibrated is false in this fixture (see below), so
      // FIRST_HALF_WINNER/HALF_TIME_FULL_TIME never read these — populated
      // anyway for completeness/defensiveness.
      firstHalfWinner: {
        home: new Decimal("0.3"),
        draw: new Decimal("0.3"),
        away: new Decimal("0.3"),
      },
      htft: {
        HOME_HOME: new Decimal("0"),
        HOME_DRAW: new Decimal("0"),
        HOME_AWAY: new Decimal("0"),
        DRAW_HOME: new Decimal("0"),
        DRAW_DRAW: new Decimal("0"),
        DRAW_AWAY: new Decimal("0"),
        AWAY_HOME: new Decimal("0"),
        AWAY_DRAW: new Decimal("0"),
        AWAY_AWAY: new Decimal("0"),
      },
    } as unknown as MatchProbabilities,
    // No longer read by any strategy (VALUE/SAFE moved to Phase 2 on
    // 2026-08-18, filtering previousDecisions instead) — kept only because
    // StrategyContext still declares the field. TODO.md: candidate for
    // removal.
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
    modelScoreThreshold: new Decimal("0.5"),
    previousDecisions: new Map(),
    ...overrides,
  };
}

function byChannel(
  decisions: StrategyDecision[],
): Map<StrategyChannel, StrategyDecision> {
  return new Map(decisions.map((d) => [d.channel, d]));
}

describe("ChannelStrategyOrchestrator (multi-channel)", () => {
  it("produces one decision per primary strategy for a rich BL1 context", () => {
    const decisions =
      createChannelStrategyOrchestrator().evaluate(makeContext());
    const map = byChannel(decisions);

    expect(decisions).toHaveLength(V1_STRATEGIES.length);
    for (const channel of [
      STRATEGY_CHANNEL.VALUE,
      STRATEGY_CHANNEL.SAFE,
      STRATEGY_CHANNEL.DOMINANT,
      STRATEGY_CHANNEL.BTTS,
      STRATEGY_CHANNEL.DRAW,
    ]) {
      expect(map.get(channel)?.status).toBe(CHANNEL_DECISION_STATUS.SELECTED);
    }
  });

  it("routes each channel to its own market/pick", () => {
    const map = byChannel(
      createChannelStrategyOrchestrator().evaluate(makeContext()),
    );

    expect(map.get(STRATEGY_CHANNEL.VALUE)?.selections[0]?.market).toBe(
      Market.ONE_X_TWO,
    );
    expect(map.get(STRATEGY_CHANNEL.VALUE)?.selections[0]?.pick).toBe("HOME");
    expect(map.get(STRATEGY_CHANNEL.SAFE)?.selections[0]?.market).toBe(
      Market.OVER_UNDER,
    );
    expect(map.get(STRATEGY_CHANNEL.DOMINANT)?.selections[0]?.pick).toBe(
      "HOME",
    );
    expect(map.get(STRATEGY_CHANNEL.BTTS)?.selections[0]?.pick).toBe("YES");
    expect(map.get(STRATEGY_CHANNEL.DRAW)?.selections[0]?.pick).toBe("DRAW");
  });

  it("throws when a strategy selects outside its allowedMarkets", () => {
    const rogue: ChannelStrategy = {
      channel: STRATEGY_CHANNEL.DOMINANT,
      allowedMarkets: [Market.ONE_X_TWO],
      evaluate: () => ({
        channel: STRATEGY_CHANNEL.DOMINANT,
        status: CHANNEL_DECISION_STATUS.SELECTED,
        selections: [
          {
            market: Market.BTTS,
            pick: "YES",
            probability: new Decimal("0.7"),
            rank: 1,
          },
        ],
      }),
    };
    const orchestrator = new ChannelStrategyOrchestrator([rogue]);
    expect(() => orchestrator.evaluate(makeContext())).toThrow(
      /disallowed market/,
    );
  });

  it("skips strategies not applicable to the context sport", () => {
    const tennisOnly: ChannelStrategy = {
      channel: STRATEGY_CHANNEL.VALUE,
      allowedMarkets: [Market.ONE_X_TWO],
      // Empty allowedSports → never includes FOOTBALL → always skipped.
      allowedSports: [],
      evaluate: () => {
        throw new Error("should not be evaluated");
      },
    };
    const orchestrator = new ChannelStrategyOrchestrator([tennisOnly]);
    expect(orchestrator.evaluate(makeContext())).toEqual([]);
  });
});
