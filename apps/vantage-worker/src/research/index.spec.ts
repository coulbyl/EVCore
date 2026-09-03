import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { ChatCompletionClient, LlmClients } from "../groq/client";
import type { ResearchInput } from "./types";
import { requestSituationalResearch } from "./index";

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
  researchProvider: "groq",
  groqResearchModel: "groq/compound-mini",
  tavilyApiKey: undefined,
  researchCompetitionCodes: ["PL", "LL"],
  couponCron: "30 20 * * *",
};

const baseInput: ResearchInput = {
  homeTeam: "Home",
  awayTeam: "Away",
  competitionCode: "PL",
  competitionName: "Premier League",
  kickoff: "2026-08-28T00:00:00.000Z",
};

const noopLogger = { warn: vi.fn() } as unknown as Logger;
// Stands in for "must not be called" — a gate rejection should return
// before ever touching a client or issuing a fetch.
const untouchedClient = undefined as unknown as ChatCompletionClient;

const groqPrimaryClients: LlmClients = {
  primary: { provider: "groq", client: untouchedClient, model: "m" },
  fallbacks: [],
};

// The real prod configuration these gating changes were made for
// (2026-08-30): LLM_PROVIDER=cerebras (primary, working around Groq's 8000
// TPM cap) with LLM_PROVIDER_FALLBACKS=groq,together.
const groqFallbackClients: LlmClients = {
  primary: { provider: "cerebras", client: untouchedClient, model: "m" },
  fallbacks: [
    { provider: "groq", client: untouchedClient, model: "m" },
    { provider: "together", client: untouchedClient, model: "m" },
  ],
};

const noGroqAnywhereClients: LlmClients = {
  primary: { provider: "cerebras", client: untouchedClient, model: "m" },
  fallbacks: [{ provider: "together", client: untouchedClient, model: "m" }],
};

describe("requestSituationalResearch — shared gating (both providers)", () => {
  it("returns null when research is globally disabled", async () => {
    const result = await requestSituationalResearch({
      clients: groqPrimaryClients,
      config: { ...baseConfig, enableResearch: false },
      input: baseInput,
      logger: noopLogger,
    });
    expect(result).toBeNull();
  });

  it("returns null when the competition isn't in the research-scoped list", async () => {
    const result = await requestSituationalResearch({
      clients: groqPrimaryClients,
      config: baseConfig,
      input: {
        ...baseInput,
        competitionCode: "USA2",
        competitionName: "USL Championship",
      },
      logger: noopLogger,
    });
    expect(result).toBeNull();
  });

  it("returns null when the fixture has no competition code", async () => {
    const result = await requestSituationalResearch({
      clients: groqPrimaryClients,
      config: baseConfig,
      input: { ...baseInput, competitionCode: null, competitionName: null },
      logger: noopLogger,
    });
    expect(result).toBeNull();
  });
});

describe("requestSituationalResearch — researchProvider: groq", () => {
  it("returns null when no configured provider (primary or fallback) is groq", async () => {
    const result = await requestSituationalResearch({
      clients: noGroqAnywhereClients,
      config: { ...baseConfig, llmProvider: "cerebras" },
      input: baseInput,
      logger: noopLogger,
    });
    expect(result).toBeNull();
  });

  it("regression 2026-08-30: reaches the Groq provider when groq is only a fallback, not primary — proven indirectly (untouched client throws, caught, logs a warning) since a gate rejection would return silently instead", async () => {
    const logger = { warn: vi.fn() } as unknown as Logger;
    const result = await requestSituationalResearch({
      clients: groqFallbackClients,
      config: { ...baseConfig, llmProvider: "cerebras" },
      input: baseInput,
      logger,
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});

describe("requestSituationalResearch — researchProvider: tavily", () => {
  it("returns null (and warns) when TAVILY_API_KEY is not set", async () => {
    const logger = { warn: vi.fn() } as unknown as Logger;
    const result = await requestSituationalResearch({
      clients: groqPrimaryClients,
      config: {
        ...baseConfig,
        researchProvider: "tavily",
        tavilyApiKey: undefined,
      },
      input: baseInput,
      logger,
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("never touches the Groq client chain even when groq is configured as primary — reaches Tavily's fetch instead (proven indirectly: no fetch mock here means the real network call fails, caught, and logs a warning distinct from the 'no key' warning)", async () => {
    const logger = { warn: vi.fn() } as unknown as Logger;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network disabled in test"));
    try {
      const result = await requestSituationalResearch({
        clients: groqPrimaryClients,
        config: {
          ...baseConfig,
          researchProvider: "tavily",
          tavilyApiKey: "tvly-test",
        },
        input: baseInput,
        logger,
      });
      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.tavily.com/search");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
