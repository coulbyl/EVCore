import { z } from "zod";
import type { Logger } from "pino";
import { sanitizeCitations } from "./types";
import type { ResearchInput, SituationalResearch } from "./types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

/** Tavily has no equivalent of Groq compound's system prompt — /search
 * takes a query string and (optionally) returns a short synthesized
 * `answer` alongside the raw results, no instructable persona. The framing
 * Groq's RESEARCH_SYSTEM_PROMPT does with a system message, Tavily can only
 * get from the query text itself — this is the practical ceiling of what a
 * search-plus-answer API (vs. an agentic model) can be steered to do. */
function buildQuery(input: ResearchInput): string {
  const { homeTeam, awayTeam, competitionName, kickoff } = input;
  return `${homeTeam} vs ${awayTeam}${competitionName ? ` (${competitionName})` : ""} — compositions probables, blessures, suspensions, enjeu du match, coup d'envoi ${kickoff}`;
}

// A genuine third-party API response — validated with Zod per CLAUDE.md
// ("Zod for all external data ... third-party API responses"), not a bare
// type assertion. `.passthrough()` on results isn't needed: sanitizeCitations
// (types.ts) already narrows unknown title/url fields defensively, so this
// schema only needs to prove the shape is an object with the right optional
// fields, not police every value.
const tavilySearchResponseSchema = z.object({
  answer: z.string().nullish(),
  results: z
    .array(
      z.object({
        title: z.unknown().optional(),
        url: z.unknown().optional(),
      }),
    )
    .optional(),
});

/**
 * The Tavily alternative to requestGroqCompoundResearch — a direct call to
 * Tavily's own /search API (https://docs.tavily.com), independent of which
 * LLM provider serves the verdict call. Reach for this over "groq" when
 * Groq's Developer tier is closed for new signups or its shared tier's
 * 8000 TPM cap makes `compound-mini` itself unreliable (see ResearchProvider
 * in config.ts) — Tavily's own free tier (1000 credits/month, no card
 * required) comfortably covers VANTAGE's research volume at the default
 * "grands championnats" scope (~240-360 basic searches/month, 1 credit
 * each — see docs/context-expansion-proposal.md's cost section).
 *
 * `include_answer: "basic"` asks Tavily for a short synthesized summary
 * alongside the raw results — used as `summary`; the results themselves
 * become `citations`, same shape as the Groq provider so prompt.ts and
 * persist-decision.ts never need to know which provider ran.
 *
 * Never throws: a failed or empty search degrades to "no research
 * available" — same contract as the Groq provider. Availability
 * (`tavilyApiKey` set at all) and the on/off/competition-scope gates are
 * the caller's job — see research/index.ts.
 */
export async function requestTavilyResearch(
  apiKey: string,
  input: ResearchInput,
  logger: Logger,
): Promise<SituationalResearch | null> {
  const { homeTeam, awayTeam, kickoff } = input;

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: buildQuery(input),
        search_depth: "basic",
        include_answer: "basic",
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily returned HTTP ${response.status}`);
    }

    const parsed = tavilySearchResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(
        `Tavily response failed schema validation: ${parsed.error.message}`,
      );
    }

    const summary = parsed.data.answer?.trim();
    if (!summary) return null;

    return { summary, citations: sanitizeCitations(parsed.data.results) };
  } catch (err) {
    logger.warn(
      { fixtureName: `${homeTeam} vs ${awayTeam}`, scheduledAt: kickoff, err },
      "vantage: Tavily research failed, continuing without it",
    );
    return null;
  }
}
