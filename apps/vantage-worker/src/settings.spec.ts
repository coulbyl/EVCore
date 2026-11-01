import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { Config } from "./config";
import { readLiveConfig, scheduledPassesEnabled } from "./settings";

const { findMany, findUnique, integrationRows } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  integrationRows: vi.fn(),
}));
vi.mock("@evcore/db", async () => {
  const actual =
    await vi.importActual<typeof import("@evcore/db")>("@evcore/db");
  return {
    deriveSettingsKey: actual.deriveSettingsKey,
    readIntegrationRows: actual.readIntegrationRows,
    prisma: {
      appSetting: { findMany, findUnique },
      integrationSetting: { findMany: integrationRows },
    },
  };
});

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
    integrationRows.mockReset();
    integrationRows.mockResolvedValue([]);
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

  it("a key stored in Réglages › Intégrations serves over the environment's", async () => {
    const { deriveSettingsKey, encryptSetting } =
      await vi.importActual<typeof import("@evcore/db")>("@evcore/db");
    process.env["SETTINGS_ENCRYPTION_KEY"] =
      "a-local-master-key-of-at-least-32-chars";
    const key = deriveSettingsKey(process.env["SETTINGS_ENCRYPTION_KEY"]);
    integrationRows.mockResolvedValue([
      {
        key: "cerebras.apiKey",
        value: encryptSetting("cerebras-db", key),
        secret: true,
      },
      {
        key: "tavily.apiKey",
        value: encryptSetting("tvly-db", key),
        secret: true,
      },
    ]);
    findMany.mockResolvedValue([]);
    const live = await readLiveConfig(base, logger);
    expect(live.llmApiKey).toBe("cerebras-db");
    expect(live.tavilyApiKey).toBe("tvly-db");
    delete process.env["SETTINGS_ENCRYPTION_KEY"];
  });

  it("a stored key gives a provider without one in the environment", async () => {
    const { deriveSettingsKey, encryptSetting } =
      await vi.importActual<typeof import("@evcore/db")>("@evcore/db");
    process.env["SETTINGS_ENCRYPTION_KEY"] =
      "a-local-master-key-of-at-least-32-chars";
    const key = deriveSettingsKey(process.env["SETTINGS_ENCRYPTION_KEY"]);
    integrationRows.mockResolvedValue([
      {
        key: "together.apiKey",
        value: encryptSetting("together-db", key),
        secret: true,
      },
    ]);
    findMany.mockResolvedValue([
      { key: "llm.providers", value: { primary: "together", fallbacks: [] } },
    ]);
    const live = await readLiveConfig(base, logger);
    expect(live.llmProvider).toBe("together");
    expect(live.llmApiKey).toBe("together-db");
    delete process.env["SETTINGS_ENCRYPTION_KEY"];
  });
});

describe("scheduledPassesEnabled", () => {
  it("on without a row, off when the row says so, on when unreadable", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await scheduledPassesEnabled(logger)).toBe(true);
    findUnique.mockResolvedValueOnce({ value: false });
    expect(await scheduledPassesEnabled(logger)).toBe(false);
    findUnique.mockRejectedValueOnce(new Error("no table"));
    expect(await scheduledPassesEnabled(logger)).toBe(true);
  });
});
