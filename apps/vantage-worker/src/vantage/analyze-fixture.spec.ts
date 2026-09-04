import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { LlmClients } from "../groq/client";
import type { MatchContext } from "../context/types";
import { analyzeFixture } from "./analyze-fixture";

const buildMatchContext = vi.fn();
const requestVantageCompletion = vi.fn();
const requestSituationalResearch = vi.fn().mockResolvedValue(null);
const persistVantageDecision = vi.fn().mockResolvedValue(undefined);

vi.mock("../context/build-match-context", () => ({
  buildMatchContext: (...args: unknown[]) => buildMatchContext(...args),
}));
vi.mock("../groq/client", () => ({
  requestVantageCompletion: (...args: unknown[]) =>
    requestVantageCompletion(...args),
}));
vi.mock("../research", () => ({
  requestSituationalResearch: (...args: unknown[]) =>
    requestSituationalResearch(...args),
}));
vi.mock("./persist-decision", () => ({
  persistVantageDecision: (...args: unknown[]) =>
    persistVantageDecision(...args),
}));

const noopLogger = { warn: vi.fn(), info: vi.fn() } as unknown as Logger;
const dummyConfig = { llmProvider: "groq" } as Config;
const dummyClients = {
  primary: { provider: "groq", client: {}, model: "m1" },
  fallbacks: [],
} as unknown as LlmClients;

const baseContext: MatchContext = {
  fixtureId: "fixture-1",
  modelRunId: "run-1",
  homeTeam: "Home FC",
  awayTeam: "Away FC",
  competitionCode: "PL",
  competitionName: "Premier League",
  kickoff: "2026-08-28T18:00:00.000Z",
  readings: [
    {
      channel: "DOMINANT",
      status: "SELECTED",
      reasonCode: null,
      market: "ONE_X_TWO",
      pick: "HOME",
      probability: 0.9,
      odds: 1.05,
      ev: -0.05,
    },
  ],
  calibration: [],
};

function playResponse(overrides: { market?: string; pick?: string } = {}) {
  return JSON.stringify({
    verdict: "play",
    market: overrides.market ?? "ONE_X_TWO",
    pick: overrides.pick ?? "HOME",
    probability: 0.6,
    reasonDetails: "test reason",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requestSituationalResearch.mockResolvedValue(null);
  persistVantageDecision.mockResolvedValue(undefined);
});

describe("analyzeFixture — MIN_ODDS floor", () => {
  it("rejects a play whose known odds are below 1.20", async () => {
    buildMatchContext.mockResolvedValue(baseContext);
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("invalid_response");
    expect(persistVantageDecision).not.toHaveBeenCalled();
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ odds: 1.05 }),
      expect.stringContaining("1.20 floor"),
    );
  });

  it("accepts a play whose known odds are at or above 1.20", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.2 }],
    });
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
    expect(persistVantageDecision).toHaveBeenCalledTimes(1);
  });

  it("accepts a play whose odds are unknown — VANTAGE has no other source of odds to check against", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: null }],
    });
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
  });

  it("never checks odds for a no_play verdict", async () => {
    buildMatchContext.mockResolvedValue(baseContext);
    requestVantageCompletion.mockResolvedValue(
      JSON.stringify({
        verdict: "no_play",
        reasonDetails: "nothing stood out",
      }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
    expect(persistVantageDecision).toHaveBeenCalledTimes(1);
  });
});

describe("analyzeFixture — calibration floor", () => {
  it("rejects ONE_X_TWO/DRAW when the DRAW channel is measured poorly calibrated (ratio < 0.85, n >= 30)", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      calibration: [
        {
          channel: "DRAW",
          sampleSize: 67,
          hitRate: 0.269,
          calibrationRatio: 0.68,
        },
      ],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ market: "ONE_X_TWO", pick: "DRAW" }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("invalid_response");
    expect(persistVantageDecision).not.toHaveBeenCalled();
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "DRAW", calibrationRatio: 0.68 }),
      expect.stringContaining("poorly calibrated"),
    );
  });

  it("accepts ONE_X_TWO/DRAW when the DRAW channel's calibration ratio is at or above 0.85", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      calibration: [
        {
          channel: "DRAW",
          sampleSize: 67,
          hitRate: 0.325,
          calibrationRatio: 0.85,
        },
      ],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ market: "ONE_X_TWO", pick: "DRAW" }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
  });

  it("accepts ONE_X_TWO/DRAW when the DRAW channel's sample size is below 30 — too noisy to gate on", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      calibration: [
        {
          channel: "DRAW",
          sampleSize: 12,
          hitRate: 0.2,
          calibrationRatio: 0.5,
        },
      ],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ market: "ONE_X_TWO", pick: "DRAW" }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
  });

  it("never gates a (market, pick) outside the named list, however bad its channel's calibration is", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
      calibration: [
        {
          channel: "DOMINANT",
          sampleSize: 500,
          hitRate: 0.1,
          calibrationRatio: 0.2,
        },
      ],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ market: "ONE_X_TWO", pick: "HOME" }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
  });

  it("never checks calibration for a no_play verdict", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      calibration: [
        {
          channel: "DRAW",
          sampleSize: 67,
          hitRate: 0.269,
          calibrationRatio: 0.68,
        },
      ],
    });
    requestVantageCompletion.mockResolvedValue(
      JSON.stringify({
        verdict: "no_play",
        reasonDetails: "nothing stood out",
      }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
  });
});
