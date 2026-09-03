import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import {
  COUPON_BOUNDS,
  COUPON_CLASSES,
  STRATEGY_CHANNEL,
} from "@evcore/analysis-core";
import type { LlmClients } from "../groq/client";
import { composeCouponClass } from "./compose-coupon-class";
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
    competition: overrides.competition ?? "Premier League",
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

// Two legs, different fixtures/competitions/canal+market, odds 1.5*1.5=2.25
// clears SAFE's 2.0 target — a validly composable pool.
function makePool(): ScoredCandidate[] {
  const candidates = [
    makeCandidate({ fixtureId: "f1", competition: "Premier League" }),
    makeCandidate({
      fixtureId: "f2",
      competition: "La Liga",
      market: "BTTS",
      pick: "YES",
      canal: STRATEGY_CHANNEL.BTTS,
    }),
    makeCandidate({
      fixtureId: "f3",
      competition: "Serie A",
      market: "GOALS",
      pick: "OVER",
      canal: STRATEGY_CHANNEL.GOALS,
    }),
  ];
  return scoreCandidates(candidates, {
    channelReliability: {},
    pooledReliability: IDENTITY,
  });
}

// Two candidates sharing the same fixture (different canal+market, so
// reduceToLlmPool's key-based dedup doesn't merge them) plus one distinct
// candidate — lets a test select two schema-valid, distinct indices that
// still violate Phase C's anti-correlation check (validate-coupon-
// selection.ts), rather than only ever exercising the schema-level
// duplicate-index rejection.
function makeSameFixturePool(): ScoredCandidate[] {
  const candidates = [
    makeCandidate({ fixtureId: "dup", competition: "Premier League" }),
    makeCandidate({
      fixtureId: "dup",
      competition: "Premier League",
      market: "BTTS",
      pick: "YES",
      canal: STRATEGY_CHANNEL.BTTS,
    }),
    makeCandidate({
      fixtureId: "f2",
      competition: "La Liga",
      market: "GOALS",
      pick: "OVER",
      canal: STRATEGY_CHANNEL.GOALS,
    }),
  ];
  return scoreCandidates(candidates, {
    channelReliability: {},
    pooledReliability: IDENTITY,
  });
}

function composeResponse(legIndices: number[]) {
  return JSON.stringify({
    verdict: "compose",
    reasonDetails: "Mix cohérent.",
    legs: legIndices.map((index) => ({ index, reasoning: "ok" })),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("composeCouponClass", () => {
  it("returns composed on the first valid attempt", async () => {
    requestVantageCompletion.mockResolvedValueOnce(composeResponse([1, 2]));
    const result = await composeCouponClass(
      makePool(),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result.outcome).toBe("composed");
    expect(requestVantageCompletion).toHaveBeenCalledTimes(1);
  });

  it("propagates empty_pool without calling the LLM", async () => {
    const tinyPool = scoreCandidates([makeCandidate()], {
      channelReliability: {},
      pooledReliability: IDENTITY,
    });
    const result = await composeCouponClass(
      tinyPool,
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result).toEqual({ outcome: "empty_pool" });
    expect(requestVantageCompletion).not.toHaveBeenCalled();
  });

  it("propagates no_coupon on the first attempt without retrying", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({ verdict: "no_coupon", reasonDetails: "Rien de bon." }),
    );
    const result = await composeCouponClass(
      makePool(),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );
    expect(result).toEqual({
      outcome: "no_coupon",
      reasonDetails: "Rien de bon.",
    });
    expect(requestVantageCompletion).toHaveBeenCalledTimes(1);
  });

  it("retries with the rejection reason fed back into the next prompt", async () => {
    // First attempt: picks legs 1 and 1 (duplicate index) -> rejected by
    // generateCouponSelection itself before validation even runs.
    requestVantageCompletion.mockResolvedValueOnce(composeResponse([1, 1]));
    // Second attempt: a valid pair.
    requestVantageCompletion.mockResolvedValueOnce(composeResponse([1, 2]));

    const result = await composeCouponClass(
      makePool(),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );

    expect(result.outcome).toBe("composed");
    expect(requestVantageCompletion).toHaveBeenCalledTimes(2);
    const secondCallUserPrompt = requestVantageCompletion.mock.calls[1]?.[2] as string;
    expect(secondCallUserPrompt).toContain("rejetée par la vérification automatique");
  });

  it("retries with the Phase C validation reason, not just a schema-level rejection", async () => {
    // First attempt: schema-valid (2 distinct indices) but both legs share
    // the same fixture — rejected by validateCouponSelection (Phase C),
    // never by generateCouponSelection's own index resolution. Two of
    // Phase C's checks could fire here (distinct-fixture count, then
    // anti-correlation) — either is fine, the point is it's THIS layer's
    // reason, not "invalid response"/"duplicate index".
    requestVantageCompletion.mockResolvedValueOnce(composeResponse([1, 2]));
    // Second attempt: swaps in the distinct-fixture candidate.
    requestVantageCompletion.mockResolvedValueOnce(composeResponse([1, 3]));

    const result = await composeCouponClass(
      makeSameFixturePool(),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
    );

    expect(result.outcome).toBe("composed");
    expect(requestVantageCompletion).toHaveBeenCalledTimes(2);
    const secondCallUserPrompt = requestVantageCompletion.mock.calls[1]?.[2] as string;
    expect(secondCallUserPrompt).toContain("distinct fixture");
    expect(secondCallUserPrompt).not.toContain("réponse précédente invalide");
  });

  it("gives up after maxAttempts, never falling back to a deterministic composer", async () => {
    // Every attempt selects the same fixture twice — always rejected.
    requestVantageCompletion.mockResolvedValue(composeResponse([1, 1]));

    const result = await composeCouponClass(
      makePool(),
      SAFE_CLASS,
      COUPON_BOUNDS,
      dummyClients,
      noopLogger,
      { maxAttempts: 2 },
    );

    expect(result.outcome).toBe("gave_up");
    if (result.outcome !== "gave_up") return;
    expect(result.attempts).toBe(2);
    expect(requestVantageCompletion).toHaveBeenCalledTimes(2);
  });
});
