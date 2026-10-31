import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { Config } from "./config";
import { readLiveConfig } from "./settings";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@evcore/db", () => ({ prisma: { appSetting: { findMany } } }));

const logger = { warn: vi.fn() } as unknown as Logger;
const base = {
  llmProvider: "cerebras",
  llmApiKey: "cerebras-key",
  llmModel: "gpt-oss-120b",
  llmBaseUrl: "https://api.cerebras.ai/v1",
  llmFallbackProviders: [],
  enableResearch: false,
  researchProvider: "groq",
  researchCompetitionCodes: ["PL"],
} as unknown as Config;

describe("readLiveConfig", () => {
  beforeEach(() => {
    findMany.mockReset();
    process.env["GROQ_API_KEY"] = "groq-key";
    delete process.env["TOGETHER_API_KEY"];
  });

  it("no row: the environment's configuration, the same object", async () => {
    findMany.mockResolvedValue([]);
    expect(await readLiveConfig(base, logger)).toBe(base);
  });

  it("an unreadable table: the environment's configuration", async () => {
    findMany.mockRejectedValue(
      new Error('relation "app_setting" does not exist'),
    );
    expect(await readLiveConfig(base, logger)).toBe(base);
  });

  it("the provider chain of the row, a provider without its key left out", async () => {
    findMany.mockResolvedValue([
      {
        key: "llm.providers",
        value: { primary: "groq", fallbacks: ["together", "cerebras"] },
      },
    ]);
    process.env["CEREBRAS_API_KEY"] = "cerebras-key";
    const live = await readLiveConfig(base, logger);
    expect(live.llmProvider).toBe("groq");
    expect(live.llmApiKey).toBe("groq-key");
    expect(live.llmFallbackProviders.map((p) => p.provider)).toEqual([
      "cerebras",
    ]);
  });

  it("a primary without its key keeps the environment's", async () => {
    findMany.mockResolvedValue([
      { key: "llm.providers", value: { primary: "together", fallbacks: [] } },
    ]);
    const live = await readLiveConfig(base, logger);
    expect(live.llmProvider).toBe("cerebras");
  });

  it("research switched by its row", async () => {
    findMany.mockResolvedValue([
      {
        key: "research",
        value: { enabled: true, provider: "tavily", competitionCodes: ["L1"] },
      },
    ]);
    const live = await readLiveConfig(base, logger);
    expect(live).toMatchObject({
      enableResearch: true,
      researchProvider: "tavily",
      researchCompetitionCodes: ["L1"],
    });
  });
});
