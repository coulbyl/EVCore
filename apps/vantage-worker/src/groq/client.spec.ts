import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import Groq from "groq-sdk";
import { requestVantageCompletion, type LlmClients } from "./client";

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
