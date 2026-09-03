import { describe, expect, it } from "vitest";
import { COUPON_BOUNDS, COUPON_CLASSES, STRATEGY_CHANNEL } from "@evcore/analysis-core";
import { validateCouponSelection } from "./validate-coupon-selection";
import { scoreCandidates, type ScoredCandidate } from "./score-candidates";
import type { PoolCandidate } from "./pool-query";
import type { SelectedLeg } from "./generate-coupon-selection";

const IDENTITY = { a: 1, b: 0, n: 0 };
const SAFE_CLASS = COUPON_CLASSES.find((c) => c.name === "SAFE");
if (!SAFE_CLASS) throw new Error("expected a SAFE class");

function makeCandidate(overrides: Partial<PoolCandidate> = {}): PoolCandidate {
  return {
    fixtureId: "f1",
    homeTeam: "Home",
    awayTeam: "Away",
    competition: "Premier League",
    country: "England",
    scheduledAt: new Date("2026-09-06T15:00:00.000Z"),
    dayBucket: "2026-09-06",
    canal: STRATEGY_CHANNEL.DOMINANT,
    market: "ONE_X_TWO",
    pick: "HOME",
    probability: 0.75,
    legEV: 0.02,
    oddsSnapshot: 1.5,
    referenceOdds: 1.45,
    pMarketFair: 0.72,
    bookmakerMargin: 0.05,
    lambdaHome: 1.4,
    lambdaAway: 1.0,
    xg: 2.4,
    finalScore: 0.7,
    dataCoverage: 1,
    shadowConflict: false,
    offensiveBalance: "BALANCED",
    priorAnalysisCount: 3,
    isCorrect: null,
    pickSource: "STAKED",
    featureSnapshot: { competitionCode: "PL" },
    homeLogo: null,
    awayLogo: null,
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    channelSelectionId: "sel1",
    modelRunId: "run1",
    ...overrides,
  };
}

function score(overrides: Partial<PoolCandidate> = {}): ScoredCandidate {
  const [scored] = scoreCandidates([makeCandidate(overrides)], {
    channelReliability: {},
    pooledReliability: IDENTITY,
  });
  if (!scored) throw new Error("expected one scored candidate");
  return scored;
}

function leg(overrides: Partial<PoolCandidate> = {}, reasoning = "ok"): SelectedLeg {
  return { candidate: score(overrides), reasoning };
}

// Two legs at 1.5 each -> combined 2.25, clears SAFE's target of 2.0.
function validPair(): SelectedLeg[] {
  return [
    leg({ fixtureId: "f1", competition: "Premier League" }),
    leg({ fixtureId: "f2", competition: "La Liga", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS }),
  ];
}

describe("validateCouponSelection", () => {
  it("accepts a well-formed selection and computes real numbers", () => {
    const result = validateCouponSelection(validPair(), SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("valid");
    if (result.outcome !== "valid") return;
    expect(result.coupon.combinedOdds).toBeCloseTo(1.5 * 1.5, 10);
    expect(result.coupon.jointProbability).toBeCloseTo(0.75 * 0.75, 10);
    expect(result.coupon.couponEV).toBeCloseTo(
      result.coupon.jointProbability * result.coupon.combinedOdds - 1,
      10,
    );
  });

  it("rejects fewer legs than bounds.minLegs", () => {
    const result = validateCouponSelection([leg()], SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects more legs than the class's maxLegs", () => {
    const legs = [
      leg({ fixtureId: "f1", competition: "C1" }),
      leg({ fixtureId: "f2", competition: "C2", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS }),
      leg({ fixtureId: "f3", competition: "C3", market: "GOALS", pick: "OVER", canal: STRATEGY_CHANNEL.GOALS }),
      leg({ fixtureId: "f4", competition: "C4", market: "DRAW_NO_BET", pick: "HOME", canal: STRATEGY_CHANNEL.DRAW_NO_BET }),
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects two legs on the same fixture", () => {
    const legs = [
      leg({ fixtureId: "f1" }),
      leg({ fixtureId: "f1", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS }),
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects two legs sharing the same canal and market", () => {
    const legs = [
      leg({ fixtureId: "f1" }),
      leg({ fixtureId: "f2" }), // same canal DOMINANT, same market ONE_X_TWO
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects more than 2 legs from the same competition", () => {
    const legs = [
      leg({ fixtureId: "f1", competition: "Premier League" }),
      leg({ fixtureId: "f2", competition: "Premier League", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS }),
      leg({ fixtureId: "f3", competition: "Premier League", market: "GOALS", pick: "OVER", canal: STRATEGY_CHANNEL.GOALS }),
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects a leg outside the class's own leg-odds band", () => {
    const legs = [
      leg({ fixtureId: "f1", oddsSnapshot: 3.0, referenceOdds: 3.0 }), // BOLD-band odds in a SAFE call
      leg({ fixtureId: "f2", competition: "La Liga", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS }),
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects a combined odds below the class's target", () => {
    const legs = [
      leg({ fixtureId: "f1", oddsSnapshot: 1.2, referenceOdds: 1.2 }),
      leg({ fixtureId: "f2", competition: "La Liga", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS, oddsSnapshot: 1.2, referenceOdds: 1.2 }),
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result).toEqual({
      outcome: "rejected",
      reason: expect.stringContaining("below the SAFE target"),
    });
  });

  it("rejects a leg with no real odds", () => {
    const legs = [
      leg({ fixtureId: "f1", oddsSnapshot: null }),
      leg({ fixtureId: "f2", competition: "La Liga", market: "BTTS", pick: "YES", canal: STRATEGY_CHANNEL.BTTS }),
    ];
    const result = validateCouponSelection(legs, SAFE_CLASS, COUPON_BOUNDS);
    expect(result.outcome).toBe("rejected");
  });
});
