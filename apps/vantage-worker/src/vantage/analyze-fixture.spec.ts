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
const persistVantageGateRejection = vi.fn().mockResolvedValue(undefined);

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
  persistVantageGateRejection: (...args: unknown[]) =>
    persistVantageGateRejection(...args),
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

function playResponse(
  overrides: { market?: string; pick?: string; basis?: string } = {},
) {
  return JSON.stringify({
    verdict: "play",
    ...(overrides.basis ? { basis: overrides.basis } : {}),
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
  persistVantageGateRejection.mockResolvedValue(undefined);
});

describe("analyzeFixture — MAX_ODDS cap and self-calibration gate (v4, 2026-10-13)", () => {
  it("gates a play whose known odds are above 1.80 and persists the refusal as a REJECTED decision", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 2.4 }],
    });
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result).toEqual({ outcome: "gated", reason: "odds_cap" });
    expect(persistVantageDecision).not.toHaveBeenCalled();
    expect(persistVantageGateRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "VANTAGE_GATED_ODDS",
        market: "ONE_X_TWO",
        pick: "HOME",
        odds: 2.4,
        text: expect.stringContaining("dépasse 1,80"),
      }),
    );
  });

  it("gates a play resting on a contradiction between our own readings (v5, 2026-10-27)", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ basis: "tension" }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result).toEqual({ outcome: "gated", reason: "basis" });
    expect(persistVantageDecision).not.toHaveBeenCalled();
    expect(persistVantageGateRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        reasonCode: "VANTAGE_GATED_BASIS",
        configVersion: "vantage-v5-no-tension",
        market: "ONE_X_TWO",
        pick: "HOME",
        text: expect.stringContaining("désaccord entre nos propres lectures"),
      }),
    );
  });

  it("still persists a play on raw statistics", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ basis: "raw_stats" }),
    );

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result).toEqual({ outcome: "persisted", verdict: "play" });
    expect(persistVantageGateRejection).not.toHaveBeenCalled();
  });

  it("gates a play on a market VANTAGE has measured itself unreliable on (ratio < 0.70, n >= 100)", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
      vantageMarketCalibration: [
        { market: "ONE_X_TWO", sampleSize: 140, calibrationRatio: 0.62 },
      ],
    });
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result).toEqual({ outcome: "gated", reason: "self_calibration" });
    expect(persistVantageGateRejection).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCode: "VANTAGE_GATED_MARKET" }),
    );
    // The closed market is announced to the model up front.
    const userPrompt = requestVantageCompletion.mock.calls[0]?.[2] as string;
    expect(userPrompt).toContain("marchés fermés");
    expect(userPrompt).toContain("ONE_X_TWO (");
  });

  it("gates a play on a market the backend guard-rail has suspended", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
      suspendedMarkets: ["ONE_X_TWO"],
    });
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result).toEqual({ outcome: "gated", reason: "self_calibration" });
    expect(persistVantageGateRejection).toHaveBeenCalledWith(
      expect.objectContaining({ reasonCode: "VANTAGE_GATED_MARKET" }),
    );
  });

  it("keeps a market open while its sample is below 100 or its ratio at or above 0.70", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
      vantageMarketCalibration: [
        { market: "ONE_X_TWO", sampleSize: 60, calibrationRatio: 0.5 },
        { market: "BTTS", sampleSize: 400, calibrationRatio: 0.84 },
      ],
    });
    requestVantageCompletion.mockResolvedValue(playResponse());

    const result = await analyzeFixture(
      "fixture-1",
      dummyClients,
      dummyConfig,
      noopLogger,
    );

    expect(result.outcome).toBe("persisted");
    expect(persistVantageGateRejection).not.toHaveBeenCalled();
  });

  it("sanitises the player-facing text before persisting, play or no_play", async () => {
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [{ ...baseContext.readings[0]!, odds: 1.5 }],
    });
    requestVantageCompletion.mockResolvedValue(
      JSON.stringify({
        verdict: "play",
        basis: "raw_stats",
        market: "ONE_X_TWO",
        pick: "HOME",
        probability: 0.6,
        reasonDetails:
          "Le canal DOMINANT (calibration 0,9×) soutient le pick ONE_X_TWO HOME.",
      }),
    );

    await analyzeFixture("fixture-1", dummyClients, dummyConfig, noopLogger);

    const persisted = persistVantageDecision.mock.calls[0]?.[2] as {
      reasonDetails: string;
      basis?: string;
    };
    expect(persisted.reasonDetails).not.toMatch(
      /ONE_X_TWO|DOMINANT|calibration 0/,
    );
    expect(persisted.reasonDetails).toContain(
      "Nos données internes soutiennent",
    );
    expect(persisted.basis).toBe("raw_stats");
  });
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

  it("persists the price with its provenance and margins, taken from the matching reading (2026-10-27)", async () => {
    const snapshotAt = new Date("2026-10-27T09:00:00Z");
    buildMatchContext.mockResolvedValue({
      ...baseContext,
      readings: [
        {
          ...baseContext.readings[0]!,
          odds: 1.5,
          oddsBookmaker: "Pinnacle",
          oddsSnapshotAt: snapshotAt,
          marginPaid: 0.031,
          marginBest: 0.024,
        },
      ],
    });
    requestVantageCompletion.mockResolvedValue(
      playResponse({ basis: "raw_stats" }),
    );

    await analyzeFixture("fixture-1", dummyClients, dummyConfig, noopLogger);

    expect(persistVantageDecision.mock.calls[0]?.[5]).toEqual({
      odds: 1.5,
      bookmaker: "Pinnacle",
      snapshotAt,
      marginPaid: 0.031,
      marginBest: 0.024,
    });
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
