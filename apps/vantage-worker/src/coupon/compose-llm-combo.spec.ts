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
    oddsSnapshot: 1.25,
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
// Plancher 1,20 (2026-10-18) : "g" est sous le plancher, "e" vient de
// VANTAGE, "f" n'est qu'une issue évaluée — aucun des trois n'est éligible.
const pool = [
  cand({ fixtureId: "a", oddsSnapshot: 1.3 }),
  cand({ fixtureId: "b", oddsSnapshot: 1.21, competition: "PL" }),
  cand({ fixtureId: "c", oddsSnapshot: 1.25, competition: "SA" }),
  cand({ fixtureId: "d", oddsSnapshot: 1.28, competition: "PL" }),
  cand({ fixtureId: "e", oddsSnapshot: 1.2, canal: "VANTAGE" }),
  cand({
    fixtureId: "f",
    oddsSnapshot: 1.2,
    pickSource: "EVALUATED",
    channelSelectionId: null,
  }),
  cand({ fixtureId: "g", oddsSnapshot: 1.1 }),
];
const cells = [green("L1"), green("PL"), green("SA")];

function compose(legs: { index: number; reasoning: string }[], reason = "x") {
  return JSON.stringify({ verdict: "compose", reasonDetails: reason, legs });
}

beforeEach(() => vi.clearAllMocks());

describe("eligibleLlmComboLegs", () => {
  it("keeps staked, priced, calibrated legs at 1.20 or more — cheapest first — and drops VANTAGE, evaluated-only and sub-floor picks", () => {
    const legs = eligibleLlmComboLegs(pool, cells);
    expect(legs.map((l) => l.fixtureId)).toEqual(["b", "c", "d", "a"]);
  });

  it("drops a leg priced under 1.10 at the operator and keeps unquoted ones", () => {
    const quotes = new Map([["b|OVER_UNDER|OVER_1_5", 1.07]]);
    const legs = eligibleLlmComboLegs(pool, cells, quotes);
    expect(legs.map((l) => l.fixtureId)).toEqual(["c", "d", "a"]);
  });
});

describe("composeLlmCombo", () => {
  it("composes two legs on distinct fixtures and competitions, announcing the channels' probabilities", async () => {
    requestVantageCompletion.mockResolvedValueOnce(
      compose(
        [
          { index: 1, reasoning: "ok" },
          { index: 4, reasoning: "ok" },
        ],
        "Deux matchs sans lien, canal GOALS solide.",
      ),
    );
    const result = await composeLlmCombo(pool, cells, clients, logger);
    expect(result.outcome).toBe("composed");
    if (result.outcome === "composed") {
      expect(result.coupon.legs.map((l) => l.candidate.fixtureId)).toEqual([
        "b",
        "a",
      ]);
      expect(result.coupon.combinedOdds).toBeCloseTo(1.21 * 1.3, 6);
      expect(result.coupon.jointProbability).toBeCloseTo(0.8 ** 2, 6);
      expect(result.reasonDetails).not.toContain("GOALS");
      expect(result.eligibleCount).toBe(4);
    }
    // The prompt shows neither odds nor probabilities.
    const userPrompt = requestVantageCompletion.mock.calls[0]?.[2] as string;
    expect(userPrompt).not.toMatch(/1\.2[15]|probabilit/);
  });

  it("refuses two legs in the same competition and retries with feedback", async () => {
    requestVantageCompletion
      .mockResolvedValueOnce(
        compose([
          { index: 1, reasoning: "a" },
          { index: 3, reasoning: "b" },
        ]),
      )
      .mockResolvedValueOnce(
        compose([
          { index: 1, reasoning: "a" },
          { index: 2, reasoning: "b" },
        ]),
      );
    const result = await composeLlmCombo(pool, cells, clients, logger);
    expect(result.outcome).toBe("composed");
    expect(requestVantageCompletion).toHaveBeenCalledTimes(2);
    const secondPrompt = requestVantageCompletion.mock.calls[1]?.[2] as string;
    expect(secondPrompt).toContain("même championnat");
  });

  it("abstains without an LLM call when fewer than two legs are eligible", async () => {
    const result = await composeLlmCombo(
      pool.slice(0, 1),
      cells,
      clients,
      logger,
    );
    expect(result).toEqual({ outcome: "empty_pool", eligibleCount: 1 });
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
