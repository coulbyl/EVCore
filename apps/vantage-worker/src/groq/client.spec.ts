import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import Groq from "groq-sdk";
import OpenAI from "openai";
import type { Config } from "../config";
import {
  createLlmClients,
  requestVantageCompletion,
  type LlmClients,
} from "./client";

function stubClient(create: (...args: unknown[]) => unknown): Groq {
  return { chat: { completions: { create } } } as unknown as Groq;
}

function okResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

const noopLogger = { warn: vi.fn(), info: vi.fn() } as unknown as Logger;

describe("requestVantageCompletion — provider fallback", () => {
  it("returns the primary's content without touching any fallback", async () => {
    const primaryCreate = vi.fn().mockResolvedValue(okResponse("{}"));
    const fallbackCreate = vi.fn();
    const clients: LlmClients = {
      primary: { provider: "groq", client: stubClient(primaryCreate), model: "m1" },
      fallbacks: [
        { provider: "cerebras", client: stubClient(fallbackCreate), model: "m2" },
      ],
    };

    const result = await requestVantageCompletion(
      clients,
      "sys",
      "user",
      noopLogger,
    );

    expect(result).toBe("{}");
    expect(primaryCreate).toHaveBeenCalledTimes(1);
    expect(fallbackCreate).not.toHaveBeenCalled();
  });

  it("falls back to the next provider on a 429 rate limit", async () => {
    const rateLimit = new Groq.APIError(
      429,
      { message: "rate limited" },
      "rate limited",
      {},
    );
    const primaryCreate = vi.fn().mockRejectedValue(rateLimit);
    const fallbackCreate = vi.fn().mockResolvedValue(okResponse('{"ok":true}'));
    const clients: LlmClients = {
      primary: { provider: "groq", client: stubClient(primaryCreate), model: "m1" },
      fallbacks: [
        { provider: "cerebras", client: stubClient(fallbackCreate), model: "m2" },
      ],
    };

    const result = await requestVantageCompletion(
      clients,
      "sys",
      "user",
      noopLogger,
    );

    expect(result).toBe('{"ok":true}');
    expect(fallbackCreate).toHaveBeenCalledTimes(1);
  });

  it("falls back on a 5xx and on a connectivity error (status undefined)", async () => {
    const serverError = new Groq.APIError(503, {}, "unavailable", {});
    const connectionError = new Groq.APIConnectionError({
      message: "timeout",
    });
    const fallbackCreate = vi.fn().mockResolvedValue(okResponse("{}"));

    for (const err of [serverError, connectionError]) {
      const clients: LlmClients = {
        primary: {
          provider: "groq",
          client: stubClient(vi.fn().mockRejectedValue(err)),
          model: "m1",
        },
        fallbacks: [
          { provider: "cerebras", client: stubClient(fallbackCreate), model: "m2" },
        ],
      };
      await expect(
        requestVantageCompletion(clients, "sys", "user", noopLogger),
      ).resolves.toBe("{}");
    }
  });

  it("does not fall back on a non-retryable error (401) — fails fast", async () => {
    const authError = new Groq.APIError(401, {}, "bad key", {});
    const primaryCreate = vi.fn().mockRejectedValue(authError);
    const fallbackCreate = vi.fn();
    const clients: LlmClients = {
      primary: { provider: "groq", client: stubClient(primaryCreate), model: "m1" },
      fallbacks: [
        { provider: "cerebras", client: stubClient(fallbackCreate), model: "m2" },
      ],
    };

    await expect(
      requestVantageCompletion(clients, "sys", "user", noopLogger),
    ).rejects.toThrow(authError.message);
    expect(fallbackCreate).not.toHaveBeenCalled();
  });

  it("throws the last provider's error once every configured provider is exhausted", async () => {
    const primaryError = new Groq.APIError(429, {}, "primary down", {});
    const fallbackError = new Groq.APIError(429, {}, "fallback down too", {});
    const clients: LlmClients = {
      primary: {
        provider: "groq",
        client: stubClient(vi.fn().mockRejectedValue(primaryError)),
        model: "m1",
      },
      fallbacks: [
        {
          provider: "cerebras",
          client: stubClient(vi.fn().mockRejectedValue(fallbackError)),
          model: "m2",
        },
      ],
    };

    await expect(
      requestVantageCompletion(clients, "sys", "user", noopLogger),
    ).rejects.toBe(fallbackError);
  });

  it("has no fallback configured — a transient error surfaces immediately", async () => {
    const rateLimit = new Groq.APIError(429, {}, "rate limited", {});
    const clients: LlmClients = {
      primary: {
        provider: "groq",
        client: stubClient(vi.fn().mockRejectedValue(rateLimit)),
        model: "m1",
      },
      fallbacks: [],
    };

    await expect(
      requestVantageCompletion(clients, "sys", "user", noopLogger),
    ).rejects.toBe(rateLimit);
  });
});

describe("createLlmClients — regression: only groq-sdk hits Groq's own /openai/v1 route", () => {
  // groq-sdk hardcodes its chat-completions path as `/openai/v1/chat/
  // completions`, unconditionally — pointing it at another provider's
  // baseURL doesn't make it generic (it produced
  // `<baseURL>/openai/v1/chat/completions`, a 404, against Cerebras in
  // prod on 2026-08-28). Every provider other than "groq" must go through
  // the real `openai` package instead, whose client posts to plain
  // `/chat/completions`.
  const baseConfig = {
    llmApiKey: "primary-key",
    llmModel: "m1",
    llmBaseUrl: undefined,
    llmFallbackProviders: [],
  } as unknown as Config;

  it("uses groq-sdk's Groq client when the primary provider is groq", () => {
    const clients = createLlmClients({ ...baseConfig, llmProvider: "groq" });
    expect(clients.primary.client).toBeInstanceOf(Groq);
  });

  it("uses the openai package's client for a non-groq primary provider", () => {
    const clients = createLlmClients({
      ...baseConfig,
      llmProvider: "cerebras",
      llmBaseUrl: "https://api.cerebras.ai/v1",
    });
    expect(clients.primary.client).toBeInstanceOf(OpenAI);
    expect(clients.primary.client).not.toBeInstanceOf(Groq);
  });

  it("picks the right SDK per fallback provider too", () => {
    const clients = createLlmClients({
      ...baseConfig,
      llmProvider: "groq",
      llmFallbackProviders: [
        {
          provider: "cerebras",
          apiKey: "fallback-key",
          model: "gpt-oss-120b",
          baseUrl: "https://api.cerebras.ai/v1",
        },
      ],
    });
    expect(clients.fallbacks[0]?.client).toBeInstanceOf(OpenAI);
  });
});
