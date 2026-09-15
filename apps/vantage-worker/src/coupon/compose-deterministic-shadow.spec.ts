import { describe, expect, it } from "vitest";
import { STRATEGY_CHANNEL } from "@evcore/analysis-core";
import { buildDeterministicShadowAttempt } from "./compose-deterministic-shadow";
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
