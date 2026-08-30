export type SituationalResearch = {
  summary: string;
  citations: { title: string; url: string }[];
};

/** What every provider implementation receives — the same fixture facts,
 * regardless of which search backend answers the question. Each provider
 * module additionally takes whatever credential/client it specifically
 * needs (a resolved Groq `LlmClient`, a Tavily API key, ...) as its own
 * separate parameter — kept out of this shared shape so a provider's
 * signature makes its own dependency obvious at the call site. */
export type ResearchInput = {
  homeTeam: string;
  awayTeam: string;
  competitionCode: string | null;
  competitionName: string | null;
  kickoff: string;
};

/** Shared citation-sanitization rule for both providers — title defaults to
 * "source" when missing/blank, an entry with no non-empty url is dropped
 * entirely. Extracted 2026-08-30 (code review) after this exact logic was
 * found copy-pasted, near-verbatim, into both groq-compound.ts and
 * tavily.ts: the two providers are meant to be interchangeable, so a future
 * fix to this rule (e.g. trimming a whitespace-only title) must apply to
 * both at once, not whichever file someone happened to be editing. */
export function sanitizeCitations(
  rawResults: readonly unknown[] | undefined,
): { title: string; url: string }[] {
  return (rawResults ?? [])
    .filter(
      (r): r is { title?: unknown; url?: unknown } =>
        typeof r === "object" && r !== null,
    )
    .map((r) => ({
      title:
        typeof r.title === "string" && r.title.trim().length > 0
          ? r.title
          : "source",
      url: typeof r.url === "string" ? r.url : "",
    }))
    .filter((c) => c.url.length > 0);
}
