import type { Logger } from "pino";
import type { LlmClient } from "../groq/client";
import { sanitizeCitations } from "./types";
import type { ResearchInput, SituationalResearch } from "./types";

const RESEARCH_SYSTEM_PROMPT = `Tu cherches des informations d'actualité factuelles sur un match de football précis : compositions probables, blessures, suspensions, enjeu du match (relégation, dead rubber, revanche), déclarations récentes de l'entraîneur. Reste factuel, cite tes sources, ne donne aucun avis ni pronostic. Si tu ne trouves rien de pertinent, dis-le simplement.`;

/**
 * The original "ouverture à internet" provider (docs/architecture.md) — a
 * separate, best-effort call to a Groq `compound` system (native web search
 * via Tavily under the hood), never the same call that produces VANTAGE's
 * structured verdict. Kept as its own step for two reasons: (1) `groq/
 * compound`'s combination with `response_format: json_object` isn't
 * documented, so composing two well-documented calls beats gambling on an
 * undocumented one; (2) it keeps the search step separately auditable —
 * logged with its own citations, distinct from the verdict's own reasoning.
 *
 * Never throws: a failed or empty search degrades to "no research available"
 * rather than blocking the (cheap, always-on) verdict call. Availability
 * (is there a Groq client at all, primary or fallback) and the on/off/
 * competition-scope gates are the caller's job — see research/index.ts.
 */
export async function requestGroqCompoundResearch(opts: {
  groqClient: LlmClient;
  model: string;
  input: ResearchInput;
  logger: Logger;
}): Promise<SituationalResearch | null> {
  const { groqClient, model, input, logger } = opts;
  const { homeTeam, awayTeam, competitionName, kickoff } = input;

  try {
    const completion = await groqClient.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: RESEARCH_SYSTEM_PROMPT },
        {
          role: "user",
          content: `${homeTeam} vs ${awayTeam}${competitionName ? ` (${competitionName})` : ""}, coup d'envoi ${kickoff}. Quelles informations d'actualité pertinentes trouves-tu sur ce match ?`,
        },
      ],
    });

    const message = completion.choices[0]?.message;
    const summary = message?.content?.trim();
    if (!summary) return null;

    // `executed_tools` is compound-specific and untyped in groq-sdk's chat
    // completion types — read it defensively rather than assume its shape.
    const executedTools = (
      message as unknown as {
        executed_tools?: { search_results?: { results?: unknown[] } }[];
      }
    ).executed_tools;
    const rawResults = executedTools?.[0]?.search_results?.results;
    return { summary, citations: sanitizeCitations(rawResults) };
  } catch (err) {
    logger.warn(
      { fixtureName: `${homeTeam} vs ${awayTeam}`, scheduledAt: kickoff, err },
      "vantage: Groq compound research failed, continuing without it",
    );
    return null;
  }
}
