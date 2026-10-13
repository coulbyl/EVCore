import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { CalibrationCell } from "@evcore/analysis-core";
import type { LlmClients } from "../groq/client";
import type { ScoredCandidate } from "./score-candidates";

const requestVantageCompletion = vi.fn();
vi.mock("../groq/client", () => ({
  requestVantageCompletion: (...args: unknown[]) =>
    requestVantageCompletion(...args),
}));

import { composeLlmCombo, eligibleLlmComboLegs } from "./compose-llm-combo";

const logger = { info: vi.fn(), warn: vi.fn() } as unknown as Logger;
const clients = {
  primary: { provider: "groq", client: {}, model: "m" },
  fallbacks: [],
} as unknown as LlmClients;

function cand(
  over: Partial<ScoredCandidate> & { fixtureId: string },
): ScoredCandidate {
  return {
    homeTeam: `Home ${over.fixtureId}`,
    awayTeam: `Away ${over.fixtureId}`,
    competition: "L1",
    country: "France",
    scheduledAt: new Date("2026-10-14T18:00:00.000Z"),
    dayBucket: "2026-10-14",
    canal: "GOALS",
    market: "OVER_UNDER",
    pick: "OVER_1_5",
    probability: 0.8,
    legEV: null,
    oddsSnapshot: 1.2,
    pMarketFair: null,
    pickSource: "STAKED",
    featureSnapshot: {},
    modelRunId: "run",
    channelSelectionId: "sel",
    calibratedProbability: 0.78,
    calibratedHitRate: 0.78,
    edge: null,
    ...over,
  } as ScoredCandidate;
}
const green = (competition: string, channel = "GOALS"): CalibrationCell => ({
  channel,
  competition,
  sampleSize: 100,
  ratio: 0.95,
});
const pool = [
  cand({ fixtureId: "a", oddsSnapshot: 1.3 }),
  cand({ fixtureId: "b", oddsSnapshot: 1.1, competition: "PL" }),
  cand({ fixtureId: "c", oddsSnapshot: 1.15, competition: "SA" }),
  cand({ fixtureId: "d", oddsSnapshot: 1.25, competition: "PL" }),
  cand({ fixtureId: "e", oddsSnapshot: 1.2, canal: "VANTAGE" }),
  cand({
    fixtureId: "f",
    oddsSnapshot: 1.2,
    pickSource: "EVALUATED",
    channelSelectionId: null,
  }),
];
const cells = [green("L1"), green("PL"), green("SA")];

beforeEach(() => vi.clearAllMocks());

describe("eligibleLlmComboLegs", () => {
  it("keeps staked, priced, calibrated short legs — cheapest first — and drops VANTAGE and evaluated-only picks", () => {
    const legs = eligibleLlmComboLegs(pool, cells);
    expect(legs.map((l) => l.fixtureId)).toEqual(["b", "c", "d", "a"]);
  });
});

describe("composeLlmCombo", () => {
  it("composes three legs on distinct fixtures and competitions, announcing the channels' probabilities", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      JSON.stringify({
        verdict: "compose",
        reasonDetails: "Trois matchs sans lien, canal GOALS solide.",
        legs: [
          { index: 1, reasoning: "ok" },
          { index: 2, reasoning: "ok" },
          { index: 4, reasoning: "ok" },
        ],
      }),
    );
    const result = await composeLlmCombo(pool, cells, clients, logger);
    expect(result.outcome).toBe("composed");
    if (result.outcome === "composed") {
      expect(result.coupon.legs.map((l) => l.candidate.fixtureId)).toEqual([
        "b",
        "c",
        "a",
      ]);
      expect(result.coupon.combinedOdds).toBeCloseTo(1.1 * 1.15 * 1.3, 6);
      expect(result.coupon.jointProbability).toBeCloseTo(0.8 ** 3, 6);
      expect(result.reasonDetails).not.toContain("GOALS");
      expect(result.eligibleCount).toBe(4);
    }
    // The prompt shows neither odds nor probabilities.
    const userPrompt = requestVantageCompletion.mock.calls[0]?.[2] as string;
    expect(userPrompt).not.toMatch(/1\\.1[05]|probabilit/);
  });

  it("refuses two legs in the same competition and retries with feedback", async () => {
    requestVantageCompletion
      .mockResolvedValueOnce(
        JSON.stringify({
          verdict: "compose",
          reasonDetails: "x",
          legs: [
            { index: 1, reasoning: "a" },
            { index: 3, reasoning: "b" },
            { index: 2, reasoning: "c" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          verdict: "compose",
          reasonDetails: "y",
          legs: [
            { index: 1, reasoning: "a" },
            { index: 2, reasoning: "b" },
            { index: 4, reasoning: "c" },
          ],
        }),
      );
    const result = await composeLlmCombo(pool, cells, clients, logger);
    expect(result.outcome).toBe("composed");
    expect(requestVantageCompletion).toHaveBeenCalledTimes(2);
    const secondPrompt = requestVantageCompletion.mock.calls[1]?.[2] as string;
    expect(secondPrompt).toContain("même championnat");
  });

  it("abstains without an LLM call when fewer than three legs are eligible", async () => {
    const result = await composeLlmCombo(
      pool.slice(0, 2),
      cells,
      clients,
      logger,
    );
    expect(result).toEqual({ outcome: "empty_pool", eligibleCount: 2 });
    expect(requestVantageCompletion).not.toHaveBeenCalled();
  });

  it("gives up after three rejected attempts", async () => {
    requestVantageCompletion.mockResolvedValue("not json");
    const result = await composeLlmCombo(pool, cells, clients, logger, {
      maxAttempts: 3,
    });
    expect(result.outcome).toBe("gave_up");
    expect(requestVantageCompletion).toHaveBeenCalledTimes(3);
  });
});
