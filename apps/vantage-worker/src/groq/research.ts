import type Groq from "groq-sdk";
import type { Logger } from "pino";
import type { Config } from "../config";

export type SituationalResearch = {
  summary: string;
  citations: { title: string; url: string }[];
};

const RESEARCH_SYSTEM_PROMPT = `Tu cherches des informations d'actualité factuelles sur un match de football précis : compositions probables, blessures, suspensions, enjeu du match (relégation, dead rubber, revanche), déclarations récentes de l'entraîneur. Reste factuel, cite tes sources, ne donne aucun avis ni pronostic. Si tu ne trouves rien de pertinent, dis-le simplement.`;

/**
 * The "ouverture à internet" lever from docs/architecture.md — a separate,
 * best-effort call to a Groq `compound` system (native web search via
 * Tavily), never the same call that produces VANTAGE's structured verdict.
 * Kept as its own step for two reasons: (1) `groq/compound`'s combination
 * with `response_format: json_object` isn't documented, so composing two
 * well-documented calls beats gambling on an undocumented one; (2) it keeps
 * the search step separately auditable — logged with its own citations,
 * distinct from the verdict's own reasoning.
 *
 * Never throws: a failed or empty search degrades to "no research available"
 * rather than blocking the (cheap, always-on) verdict call.
 *
 * Gated on TWO levels, independently: `config.enableResearch` (the global
 * on/off switch) AND `config.researchCompetitionCodes` (which leagues get
 * the costed call — VANTAGE still writes a verdict on every fixture either
 * way, research just doesn't run everywhere by default).
 */
export async function requestSituationalResearch(
  client: Groq,
  config: Config,
  homeTeam: string,
  awayTeam: string,
  competitionCode: string | null,
  competitionName: string | null,
  kickoff: string,
  logger: Logger,
): Promise<SituationalResearch | null> {
  if (!config.enableResearch) return null;
  if (
    competitionCode === null ||
    !config.researchCompetitionCodes.includes(competitionCode)
  ) {
    return null;
  }

  try {
    const completion = await client.chat.completions.create({
      model: config.groqResearchModel,
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
    const rawResults = executedTools?.[0]?.search_results?.results ?? [];
    const citations = rawResults
      .filter(
        (r): r is { title?: unknown; url?: unknown } =>
          typeof r === "object" && r !== null,
      )
      .map((r) => ({
        title: typeof r.title === "string" ? r.title : "source",
        url: typeof r.url === "string" ? r.url : "",
      }))
      .filter((c) => c.url.length > 0);

    return { summary, citations };
  } catch (err) {
    logger.warn(
      { err },
      "vantage: situational research failed, continuing without it",
    );
    return null;
  }
}
