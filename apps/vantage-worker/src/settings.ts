import { prisma } from "@evcore/db";
import { parseAppSetting } from "@evcore/analysis-core";
import type { Logger } from "pino";
import { resolveProvider, type Config } from "./config";
import { createLlmClients, type LlmClients } from "./groq/client";

/**
 * The operator switches of the worker (12-admin § 4): the LLM provider
 * chain and web research, read from `app_setting` at every pass. A row
 * absent, malformed or unreadable leaves the environment's value (the
 * transition of ENV-PROD § 6): a deploy changes nothing until a row is
 * written. A provider named without its key in the environment is left
 * out, and a primary without one keeps the environment's primary.
 */
export async function readLiveConfig(
  base: Config,
  logger: Logger,
): Promise<Config> {
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
    const primary = resolveProvider(llm.primary);
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
            const fallback = resolveProvider(name);
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
