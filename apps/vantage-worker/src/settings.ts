import { deriveSettingsKey, prisma, readIntegrationRows } from "@evcore/db";
import { parseAppSetting } from "@evcore/analysis-core";
import type { Logger } from "pino";
import { resolveProvider, type Config } from "./config";
import { createLlmClients, type LlmClients } from "./groq/client";

/**
 * The operator switches of the worker (12-admin § 4): the LLM provider
 * chain and web research, read from `app_setting` at every pass. A row
 * absent, malformed or unreadable leaves the environment's value (the
 * transition of ENV-PROD § 6): a deploy changes nothing until a row is
 * written. The providers' keys come from Réglages › Intégrations when
 * stored there, else from the environment. A provider named without any
 * key is left out, and a primary without one keeps the environment's.
 */
/** The worker's keys in Réglages › Intégrations (the backend writes them). */
const WORKER_KEYS = [
  "groq.apiKey",
  "cerebras.apiKey",
  "together.apiKey",
  "fireworks.apiKey",
  "tavily.apiKey",
];

/**
 * The keys stored in Réglages › Intégrations, decrypted with
 * SETTINGS_ENCRYPTION_KEY (the backend's). A table unreadable, a key absent
 * or another key: nothing, and the environment's keys serve.
 */
async function storedKeys(logger: Logger): Promise<Map<string, string>> {
  try {
    const rows = await prisma.integrationSetting.findMany({
      where: { key: { in: WORKER_KEYS } },
      select: { key: true, value: true, secret: true },
    });
    const secret = process.env["SETTINGS_ENCRYPTION_KEY"];
    const read = readIntegrationRows(
      rows,
      secret ? deriveSettingsKey(secret) : null,
    );
    if (read.unreadable.length > 0) {
      logger.warn(
        { keys: read.unreadable },
        "vantage: stored keys unreadable (SETTINGS_ENCRYPTION_KEY absent or different), using the environment",
      );
    }
    return read.values;
  } catch (err) {
    logger.warn(
      { err },
      "vantage: integration_setting unreadable, using the environment's keys",
    );
    return new Map();
  }
}

/** The base configuration with the stored keys over the environment's. */
function withStoredKeys(base: Config, keys: Map<string, string>): Config {
  if (keys.size === 0) return base;
  const key = (provider: string) => keys.get(`${provider}.apiKey`);
  return {
    ...base,
    llmApiKey: key(base.llmProvider) ?? base.llmApiKey,
    llmFallbackProviders: base.llmFallbackProviders.map((fallback) => ({
      ...fallback,
      apiKey: key(fallback.provider) ?? fallback.apiKey,
    })),
    tavilyApiKey: keys.get("tavily.apiKey") ?? base.tavilyApiKey,
  };
}

export async function readLiveConfig(
  env: Config,
  logger: Logger,
): Promise<Config> {
  // The keys first (Réglages › Intégrations), then the switches.
  const keys = await storedKeys(logger);
  const base = withStoredKeys(env, keys);
  let rows: { key: string; value: unknown }[];
  try {
    rows = await prisma.appSetting.findMany({
      where: { key: { in: ["llm.providers", "research"] } },
      select: { key: true, value: true },
    });
  } catch (err) {
    logger.warn(
      { err },
      "vantage: app_setting unreadable, using the environment",
    );
    return base;
  }
  const raw = (key: string) => rows.find((row) => row.key === key)?.value;

  let config = base;
  const llmRow = raw("llm.providers");
  const llm =
    llmRow === undefined ? null : parseAppSetting("llm.providers", llmRow);
  if (llmRow !== undefined && llm === null) {
    logger.warn({ llmRow }, "vantage: llm.providers malformed, ignored");
  }
  if (llm) {
    const primary = resolveProvider(llm.primary, keys);
    if (!primary) {
      logger.warn(
        { provider: llm.primary },
        "vantage: llm.providers names a primary without its key, ignored",
      );
    } else {
      config = {
        ...config,
        llmProvider: primary.provider,
        llmApiKey: primary.apiKey,
        llmModel: primary.model,
        llmBaseUrl: primary.baseUrl,
        llmFallbackProviders: llm.fallbacks
          .filter((name) => name !== llm.primary)
          .flatMap((name) => {
            const fallback = resolveProvider(name, keys);
            return fallback ? [fallback] : [];
          }),
      };
    }
  }

  const researchRow = raw("research");
  const research =
    researchRow === undefined ? null : parseAppSetting("research", researchRow);
  if (research) {
    config = {
      ...config,
      enableResearch: research.enabled,
      researchProvider: research.provider,
      researchCompetitionCodes: research.competitionCodes,
    };
  }
  return config;
}

/**
 * « Passes planifiées » (12-admin § 4), the same row the backend reads: off,
 * the worker's own scheduled passes (sweep, coupon generation) skip. On
 * when the row is absent, malformed or unreadable.
 */
export async function scheduledPassesEnabled(logger: Logger): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: "scheduling.enabled" },
      select: { value: true },
    });
    if (!row) return true;
    return parseAppSetting("scheduling.enabled", row.value) ?? true;
  } catch (err) {
    logger.warn({ err }, "vantage: app_setting unreadable, passes stay on");
    return true;
  }
}

/** One set of clients per provider chain: built once, reused across passes. */
const clientsByChain = new Map<string, LlmClients>();

export function clientsFor(config: Config): LlmClients {
  const chain = [
    config.llmProvider,
    ...config.llmFallbackProviders.map((p) => p.provider),
  ].join(",");
  const known = clientsByChain.get(chain);
  if (known) return known;
  const clients = createLlmClients(config);
  clientsByChain.set(chain, clients);
  return clients;
}
