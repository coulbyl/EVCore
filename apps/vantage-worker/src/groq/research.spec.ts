import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { Config } from "../config";
import type { ChatCompletionClient, LlmClients } from "./client";
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
// Stands in for "must not be called" — the gate should reject before ever
// touching a client.
const untouchedClient = undefined as unknown as ChatCompletionClient;

const groqPrimaryClients: LlmClients = {
  primary: { provider: "groq", client: untouchedClient, model: "m" },
  fallbacks: [],
};

// The real prod configuration this whole gate was fixed for (2026-08-30):
// LLM_PROVIDER=cerebras (primary, working around Groq's 8000 TPM cap) with
// LLM_PROVIDER_FALLBACKS=groq,together — research must still find the Groq
// client here, even though it's a fallback for the verdict call.
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

describe("requestSituationalResearch — gating", () => {
  it("returns null when research is globally disabled", async () => {
    const result = await requestSituationalResearch(
      groqPrimaryClients,
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
      groqPrimaryClients,
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
      groqPrimaryClients,
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

  it("returns null when no configured provider (primary or fallback) is groq", async () => {
    const result = await requestSituationalResearch(
      noGroqAnywhereClients,
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

  it("regression 2026-08-30: does NOT return null when groq is only a fallback, not primary — the real prod config that motivated this fix (LLM_PROVIDER=cerebras, LLM_PROVIDER_FALLBACKS=groq,together) — it must reach the client call instead of short-circuiting on the gate", async () => {
    // groqFallbackClients' clients are `untouchedClient` (undefined), so a
    // gate that incorrectly rejects would return null here just like the
    // "no groq anywhere" case above; a gate that correctly finds the
    // fallback client instead proceeds to call it and throws on the
    // undefined client — proving the gate passed. The try/catch in
    // requestSituationalResearch then degrades that throw to null, so we
    // assert indirectly: this case must behave differently from a config
    // gate rejection, which we verify via the logger being invoked (only
    // the try/catch path logs a warning; a gate rejection returns silently).
    const logger = { warn: vi.fn() } as unknown as Logger;
    const result = await requestSituationalResearch(
      groqFallbackClients,
      { ...baseConfig, llmProvider: "cerebras" },
      "Home",
      "Away",
      "PL",
      "Premier League",
      "2026-08-28T00:00:00.000Z",
      logger,
    );
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
