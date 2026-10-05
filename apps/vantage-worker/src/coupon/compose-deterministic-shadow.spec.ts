import { describe, expect, it } from "vitest";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import {
  buildDeterministicShadowAttempt,
  buildProbabilityRankedShadowAttempt,
} from "./compose-deterministic-shadow";
import type { ScoredCandidate } from "./score-candidates";

function candidate(
  id: string,
  overrides: Partial<ScoredCandidate> = {},
): ScoredCandidate {
  return {
    fixtureId: id,
    homeTeam: `Home ${id}`,
    awayTeam: `Away ${id}`,
    competition: `Competition ${id}`,
    country: "Country",
    scheduledAt: new Date("2026-09-20T15:00:00.000Z"),
    dayBucket: "2026-09-20",
    canal: STRATEGY_CHANNEL.GOALS,
    market: "OVER_UNDER",
    pick: "OVER_2_5",
    probability: 0.5,
    calibratedProbability: 0.5,
    calibratedHitRate: 0.5,
    legEV: 0.1,
    edge: 0,
    oddsSnapshot: 2.3,
    referenceOdds: 2,
    pMarketFair: 0.5,
    bookmakerMargin: 0.05,
    lambdaHome: 1.4,
    lambdaAway: 1.1,
    xg: 2.5,
    finalScore: 0.7,
    dataCoverage: 1,
    shadowConflict: false,
    offensiveBalance: "BALANCED",
    priorAnalysisCount: 3,
    isCorrect: null,
    pickSource: "STAKED",
    featureSnapshot: {},
    homeLogo: null,
    awayLogo: null,
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    channelSelectionId: `selection-${id}`,
    modelRunId: `run-${id}`,
    ...overrides,
  };
}

const inputBase = {
  forDate: new Date("2026-09-20T00:00:00.000Z"),
  pass: "EVENING" as const,
};

describe("buildDeterministicShadowAttempt", () => {
  it("records the frozen deterministic coupon without publishing it", () => {
    const attempt = buildDeterministicShadowAttempt({
      ...inputBase,
      scoredPool: [
        candidate("a", { canal: STRATEGY_CHANNEL.GOALS }),
        candidate("b", { canal: STRATEGY_CHANNEL.BTTS }),
        candidate("c", { canal: STRATEGY_CHANNEL.TEAM_TOTAL }),
      ],
    });

    expect(attempt.outcome).toBe("SHADOW_COMPOSED");
    expect(attempt.policyVersion).toBe("deterministic-5-7-v1");
    expect(attempt.proposalId).toBeUndefined();
    expect(attempt.metadata?.["mode"]).toBe("SHADOW");
    expect(attempt.metadata?.["combinedOdds"]).toBeCloseTo(5.29, 10);
  });

  it("excludes VANTAGE and untracked evaluated-market candidates", () => {
    const attempt = buildDeterministicShadowAttempt({
      ...inputBase,
      scoredPool: [
        candidate("vantage", { canal: STRATEGY_CHANNEL.VANTAGE }),
        candidate("evaluated", {
          pickSource: "EVALUATED",
          channelSelectionId: null,
        }),
      ],
    });

    expect(attempt).toMatchObject({
      outcome: "SHADOW_ABSTAINED",
      candidateCount: 0,
      reason: "candidate_pool_too_small",
    });
  });
});

describe("buildProbabilityRankedShadowAttempt", () => {
  it("composes without the EV gates, in the live class band, under its own policy version", () => {
    // Three legs at 1.60 with calibrated 0.60: p × odds = 0.96 < 1, which
    // the v1 admission rejects. Combined odds 4.1 < 5, so a fourth leg is
    // needed; the v2 shadow still composes from them.
    // One leg per (canal, market): the anti-correlation rule admits a
    // single leg per canal × market in a coupon.
    const wagers = [
      ["a", STRATEGY_CHANNEL.GOALS, "OVER_UNDER", "OVER_2_5"],
      ["b", STRATEGY_CHANNEL.BTTS, "BTTS", "YES"],
      ["c", STRATEGY_CHANNEL.DOUBLE_CHANCE, "DOUBLE_CHANCE", "1X"],
      ["d", STRATEGY_CHANNEL.TEAM_TOTAL, "TEAM_TOTAL_HOME", "OVER_0_5"],
    ] as const;
    const legs = wagers.map(([id, canal, market, pick]) =>
      candidate(id, {
        canal,
        market,
        pick,
        oddsSnapshot: 1.6,
        referenceOdds: 1.6,
        calibratedProbability: 0.6,
        calibratedHitRate: 0.6,
        probability: 0.6,
        pMarketFair: 0.625,
        edge: -0.025,
        competition: `Competition ${id}`,
      }),
    );

    const attempt = buildProbabilityRankedShadowAttempt({
      ...inputBase,
      scoredPool: legs,
    });

    expect(attempt.policyVersion).toBe("unified-5-15-v2-shadow");
    expect(attempt.outcome).toBe("SHADOW_COMPOSED");
    expect(attempt.metadata).toMatchObject({
      mode: "SHADOW",
      objective: "max_joint_probability_no_ev_gate",
    });
    const metadata = attempt.metadata as { couponEV: number; legs: unknown[] };
    expect(metadata.couponEV).toBeLessThan(0);
    expect(metadata.legs).toHaveLength(4);

    // The frozen deterministic shadow, with its EV gate, abstains on the same pool.
    const frozen = buildDeterministicShadowAttempt({
      ...inputBase,
      scoredPool: legs,
    });
    expect(frozen.outcome).toBe("SHADOW_ABSTAINED");
  });

  it("still enforces the live leg band and the edge ceiling", () => {
    const legs = [
      candidate("long", { oddsSnapshot: 2.2, referenceOdds: 2.2 }), // > 1.80
      candidate("edge", {
        oddsSnapshot: 1.5,
        referenceOdds: 1.5,
        calibratedProbability: 0.85, // edge 0.183 > MAX_LEG_EDGE
        calibratedHitRate: 0.85,
      }),
    ];
    const attempt = buildProbabilityRankedShadowAttempt({
      ...inputBase,
      scoredPool: legs,
    });
    expect(attempt.outcome).toBe("SHADOW_ABSTAINED");
  });
});

