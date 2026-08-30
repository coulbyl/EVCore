import type { Logger } from "pino";
import type { Config } from "../config";
import { findProviderClient, type LlmClients } from "../groq/client";
import { requestGroqCompoundResearch } from "./groq-compound";
import { requestTavilyResearch } from "./tavily";
import type { ResearchInput, SituationalResearch } from "./types";

export type { SituationalResearch } from "./types";

/**
 * The "ouverture à internet" lever from docs/architecture.md — dispatches
 * to whichever backend `config.researchProvider` names (see
 * ResearchProvider in config.ts). Both providers share the exact same
 * contract: never throw, degrade to `null` on any failure, log a warning
 * rather than fail the fixture's analysis.
 *
 * Gated on THREE levels, independently, before either provider is ever
 * touched: `config.enableResearch` (the global on/off switch),
 * `config.researchCompetitionCodes` (which leagues get the costed call —
 * VANTAGE still writes a verdict on every fixture either way, research just
 * doesn't run everywhere by default), and provider availability — a Groq
 * client configured somewhere (primary or fallback — findProviderClient)
 * for "groq", or `config.tavilyApiKey` being set for "tavily". Switching
 * `VANTAGE_RESEARCH_PROVIDER` never requires a code change.
 *
 * Takes a single options object (CLAUDE.md: max 3 positional params —
 * this originally took 8) rather than one param per fixture fact; the
 * fixture facts themselves are grouped under `input` (ResearchInput,
 * shared with both provider modules).
 */
export async function requestSituationalResearch(opts: {
  clients: LlmClients;
  config: Config;
  input: ResearchInput;
  logger: Logger;
}): Promise<SituationalResearch | null> {
  const { clients, config, input, logger } = opts;
  if (!config.enableResearch) return null;
  if (
    input.competitionCode === null ||
    !config.researchCompetitionCodes.includes(input.competitionCode)
  ) {
    return null;
  }

  if (config.researchProvider === "tavily") {
    if (!config.tavilyApiKey) {
      logger.warn(
        {},
        "vantage: VANTAGE_RESEARCH_PROVIDER=tavily but TAVILY_API_KEY is not set — skipping research for this fixture",
      );
      return null;
    }
    return requestTavilyResearch(config.tavilyApiKey, input, logger);
  }

  const groqClient = findProviderClient(clients, "groq");
  if (groqClient === null) return null;
  return requestGroqCompoundResearch({
    groqClient,
    model: config.groqResearchModel,
    input,
    logger,
  });
}
