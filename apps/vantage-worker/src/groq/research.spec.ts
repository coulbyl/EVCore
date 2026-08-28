import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type Groq from "groq-sdk";
import type { Config } from "../config";
import { requestSituationalResearch } from "./research";

const baseConfig: Config = {
  databaseUrl: "postgresql://x",
  redisHost: "localhost",
  redisPort: 6379,
  llmProvider: "groq",
  llmApiKey: "test",
  llmModel: "openai/gpt-oss-120b",
  llmBaseUrl: undefined,
  llmFallbackProviders: [],
  logLevel: "info",
  sweepIntervalMs: 300_000,
  competitionCodes: [],
  enableResearch: true,
  groqResearchModel: "groq/compound-mini",
  researchCompetitionCodes: ["PL", "LL"],
};

const noopLogger = { warn: vi.fn() } as unknown as Logger;
// The client is never touched when the gate rejects — undefined stands in
// for "must not be called".
const untouchedClient = undefined as unknown as Groq;

describe("requestSituationalResearch — gating", () => {
  it("returns null when research is globally disabled", async () => {
    const result = await requestSituationalResearch(
      untouchedClient,
      { ...baseConfig, enableResearch: false },
      "Home",
      "Away",
      "PL",
      "Premier League",
      "2026-08-28T00:00:00.000Z",
      noopLogger,
    );
    expect(result).toBeNull();
  });

  it("returns null when the competition isn't in the research-scoped list", async () => {
    const result = await requestSituationalResearch(
      untouchedClient,
      baseConfig,
      "Home",
      "Away",
      "USA2",
      "USL Championship",
      "2026-08-28T00:00:00.000Z",
      noopLogger,
    );
    expect(result).toBeNull();
  });

  it("returns null when the fixture has no competition code", async () => {
    const result = await requestSituationalResearch(
      untouchedClient,
      baseConfig,
      "Home",
      "Away",
      null,
      null,
      "2026-08-28T00:00:00.000Z",
      noopLogger,
    );
    expect(result).toBeNull();
  });

  it("returns null on a non-Groq provider even if otherwise eligible", async () => {
    const result = await requestSituationalResearch(
      untouchedClient,
      { ...baseConfig, llmProvider: "cerebras" },
      "Home",
      "Away",
      "PL",
      "Premier League",
      "2026-08-28T00:00:00.000Z",
      noopLogger,
    );
    expect(result).toBeNull();
  });
});
