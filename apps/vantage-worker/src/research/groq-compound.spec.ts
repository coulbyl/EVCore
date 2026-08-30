import { describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { LlmClient } from "../groq/client";
import { requestGroqCompoundResearch } from "./groq-compound";

const noopLogger = { warn: vi.fn() } as unknown as Logger;

const baseInput = {
  homeTeam: "Home FC",
  awayTeam: "Away FC",
  competitionCode: "PL",
  competitionName: "Premier League",
  kickoff: "2026-08-28T18:00:00.000Z",
};

function clientReturning(content: string | null, executedTools?: unknown) {
  return {
    provider: "groq" as const,
    model: "groq/compound-mini",
    client: {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content, executed_tools: executedTools } }],
          }),
        },
      },
    },
  } satisfies LlmClient;
}

describe("requestGroqCompoundResearch", () => {
  it("returns the summary and citations from a well-formed response", async () => {
    const client = clientReturning("Aucune blessure signalée côté Home FC.", [
      {
        search_results: {
          results: [{ title: "Team news", url: "https://example.com/news" }],
        },
      },
    ]);
    const result = await requestGroqCompoundResearch({
      groqClient: client,
      model: client.model,
      input: baseInput,
      logger: noopLogger,
    });
    expect(result).toEqual({
      summary: "Aucune blessure signalée côté Home FC.",
      citations: [{ title: "Team news", url: "https://example.com/news" }],
    });
  });

  it("returns null when the completion has no content", async () => {
    const client = clientReturning(null);
    const result = await requestGroqCompoundResearch({
      groqClient: client,
      model: client.model,
      input: baseInput,
      logger: noopLogger,
    });
    expect(result).toBeNull();
  });

  it("drops citation entries with no url, and falls back to 'source' when title is missing", async () => {
    const client = clientReturning("Résumé.", [
      {
        search_results: {
          results: [
            { title: "Has url", url: "https://example.com/a" },
            { title: "No url" },
            { url: "https://example.com/b" },
          ],
        },
      },
    ]);
    const result = await requestGroqCompoundResearch({
      groqClient: client,
      model: client.model,
      input: baseInput,
      logger: noopLogger,
    });
    expect(result?.citations).toEqual([
      { title: "Has url", url: "https://example.com/a" },
      { title: "source", url: "https://example.com/b" },
    ]);
  });

  it("returns null and logs a warning when the client throws", async () => {
    const logger = { warn: vi.fn() } as unknown as Logger;
    const client: LlmClient = {
      provider: "groq",
      model: "groq/compound-mini",
      client: {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("429")),
          },
        },
      },
    };
    const result = await requestGroqCompoundResearch({
      groqClient: client,
      model: client.model,
      input: baseInput,
      logger,
    });
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
