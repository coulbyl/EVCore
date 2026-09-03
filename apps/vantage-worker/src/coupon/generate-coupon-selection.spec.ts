import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import {
  COUPON_BOUNDS,
  COUPON_CLASSES,
  STRATEGY_CHANNEL,
} from "@evcore/analysis-core";
import type { LlmClients } from "../groq/client";
import { generateCouponSelection } from "./generate-coupon-selection";
import { scoreCandidates, type ScoredCandidate } from "./score-candidates";
import type { PoolCandidate } from "./pool-query";

const requestVantageCompletion = vi.fn();
vi.mock("../groq/client", () => ({
  requestVantageCompletion: (...args: unknown[]) =>
    requestVantageCompletion(...args),
}));

const noopLogger = { warn: vi.fn(), info: vi.fn() } as unknown as Logger;
const dummyClients = {
  primary: { provider: "groq", client: {}, model: "m1" },
  fallbacks: [],
} as unknown as LlmClients;

const IDENTITY = { a: 1, b: 0, n: 0 };
const SAFE_CLASS = COUPON_CLASSES.find((c) => c.name === "SAFE");
if (!SAFE_CLASS) throw new Error("expected a SAFE class");

function makeCandidate(overrides: Partial<PoolCandidate> = {}): PoolCandidate {
  return {
    fixtureId: overrides.fixtureId ?? "f1",
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
    oddsSnapshot: 1.4,
    referenceOdds: 1.35,
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

function makePool(count: number): ScoredCandidate[] {
  const candidates = Array.from({ length: count }, (_, i) =>
    makeCandidate({ fixtureId: `f${i}`, competition: `Comp ${i}` }),
  );
  return scoreCandidates(candidates, {
    channelReliability: {},
    pooledReliability: IDENTITY,
  });
}

describe("generateCouponSelection", () => {
  it("returns empty_pool without calling the LLM when the class band has too few candidates", async () => {
    const result = await generateCouponSelection(
      makePool(1),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result).toEqual({ outcome: "empty_pool" });
    expect(requestVantageCompletion).not.toHaveBeenCalled();
  });

  it("returns no_coupon when the model declines", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({
        verdict: "no_coupon",
        reasonDetails: "Rien de cohérent dans ce vivier.",
      }),
    );
    const result = await generateCouponSelection(
      makePool(3),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result).toEqual({
      outcome: "no_coupon",
      reasonDetails: "Rien de cohérent dans ce vivier.",
    });
  });

  it("resolves selected indices back to real candidates", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({
        verdict: "compose",
        reasonDetails: "Deux ancres cohérentes.",
        legs: [
          { index: 1, reasoning: "Solide favori." },
          { index: 2, reasoning: "Complète bien la première." },
        ],
      }),
    );
    const result = await generateCouponSelection(
      makePool(3),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    if (result.outcome !== "composed") throw new Error("expected composed");
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]?.candidate.fixtureId).toBeDefined();
    expect(result.legs[0]?.reasoning).toBe("Solide favori.");
  });

  it("rejects a response that selects an out-of-range index", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({
        verdict: "compose",
        reasonDetails: "...",
        legs: [
          { index: 1, reasoning: "ok" },
          { index: 999, reasoning: "hallucinated" },
        ],
      }),
    );
    const result = await generateCouponSelection(
      makePool(3),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result.outcome).toBe("invalid_response");
  });

  it("rejects a response that selects the same index twice", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({
        verdict: "compose",
        reasonDetails: "...",
        legs: [
          { index: 1, reasoning: "ok" },
          { index: 1, reasoning: "duplicate" },
        ],
      }),
    );
    const result = await generateCouponSelection(
      makePool(3),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result.outcome).toBe("invalid_response");
  });

  it("rejects non-JSON output", async () => {
    requestVantageCompletion.mockResolvedValueOnce("not json at all");
    const result = await generateCouponSelection(
      makePool(3),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result).toMatchObject({ outcome: "invalid_response", error: "not_json" });
  });

  it("rejects a compose response with fewer legs than minLegs", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({
        verdict: "compose",
        reasonDetails: "...",
        legs: [{ index: 1, reasoning: "only one" }],
      }),
    );
    const result = await generateCouponSelection(
      makePool(3),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result.outcome).toBe("invalid_response");
  });
});
