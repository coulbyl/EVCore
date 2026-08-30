import { describe, expect, it, vi, afterEach } from "vitest";
import type { Logger } from "pino";
import { requestTavilyResearch } from "./tavily";

const noopLogger = { warn: vi.fn() } as unknown as Logger;

const baseInput = {
  homeTeam: "Home FC",
  awayTeam: "Away FC",
  competitionCode: "PL",
  competitionName: "Premier League",
  kickoff: "2026-08-28T18:00:00.000Z",
};

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestTavilyResearch", () => {
  it("posts to Tavily's /search endpoint with the api key and a built query", async () => {
    const fetchSpy = mockFetchOnce({
      answer: "Aucune blessure signalée.",
      results: [{ title: "Team news", url: "https://example.com/news" }],
    });

    const result = await requestTavilyResearch(
      "tvly-test",
      baseInput,
      noopLogger,
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.tavily.com/search");
    const body = JSON.parse(init.body as string);
    expect(body.api_key).toBe("tvly-test");
    expect(body.query).toContain("Home FC vs Away FC");
    expect(result).toEqual({
      summary: "Aucune blessure signalée.",
      citations: [{ title: "Team news", url: "https://example.com/news" }],
    });
  });

  it("returns null when Tavily returns no answer", async () => {
    mockFetchOnce({ results: [] });
    const result = await requestTavilyResearch(
      "tvly-test",
      baseInput,
      noopLogger,
    );
    expect(result).toBeNull();
  });

  it("drops citation entries with no url, and falls back to 'source' when title is missing", async () => {
    mockFetchOnce({
      answer: "Résumé.",
      results: [
        { title: "Has url", url: "https://example.com/a" },
        { title: "No url" },
        { url: "https://example.com/b" },
      ],
    });
    const result = await requestTavilyResearch(
      "tvly-test",
      baseInput,
      noopLogger,
    );
    expect(result?.citations).toEqual([
      { title: "Has url", url: "https://example.com/a" },
      { title: "source", url: "https://example.com/b" },
    ]);
  });

  it("returns null and logs a warning on a non-ok HTTP response", async () => {
    mockFetchOnce({}, false, 401);
    const logger = { warn: vi.fn() } as unknown as Logger;
    const result = await requestTavilyResearch("bad-key", baseInput, logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("returns null and logs a warning when fetch itself rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const logger = { warn: vi.fn() } as unknown as Logger;
    const result = await requestTavilyResearch("tvly-test", baseInput, logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
