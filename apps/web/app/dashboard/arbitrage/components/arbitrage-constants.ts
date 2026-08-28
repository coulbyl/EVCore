import type {
  ChannelDecisionDto,
  ChannelDecisionMatchDto,
} from "@/domains/channel-decision/types/channel-decision";

// One VANTAGE ("Arbitrage") read, with its fixture context flattened in —
// `useChannelDecisionMatches(date, { channel: "VANTAGE" })` returns fixtures
// grouped with their (0 or 1) VANTAGE decision nested inside `decisions`;
// the feed reads one entry per read, so it's flattened once here instead of
// threading `match.<field>` through every card.
export type ArbitrageEntry = Pick<
  ChannelDecisionMatchDto,
  | "fixtureId"
  | "fixtureStatus"
  | "competition"
  | "competitionName"
  | "country"
  | "homeTeam"
  | "awayTeam"
  | "homeLogo"
  | "awayLogo"
  | "kickoff"
  | "scheduledAt"
  | "score"
  | "htScore"
> &
  Pick<
    ChannelDecisionDto,
    "id" | "status" | "reasonDetails" | "decidedAt" | "selections"
  > & {
    // VANTAGE never writes its own odds (its response schema has none — see
    // apps/vantage-worker/src/vantage/response-schema.ts) — borrowed from a
    // sibling channel's decision on the SAME ModelRun that landed on the
    // exact same (market, pick), when one exists. Mirrors what VANTAGE
    // itself checks at generation time (analyze-fixture.ts's
    // findKnownOdds/MIN_ODDS floor) — the only odds it can honestly claim,
    // never invented.
    borrowedOdds: number | null;
  };

function findSiblingOdds(
  decisions: ChannelDecisionMatchDto["decisions"],
  market: string,
  pick: string,
): number | null {
  for (const decision of decisions) {
    if (decision.channel === "VANTAGE") continue;
    const match = decision.selections.find(
      (s) => s.market === market && s.pick === pick && s.odds !== null,
    );
    if (match) return match.odds;
  }
  return null;
}

// Requires the UNFILTERED /channel-decisions/by-match response (every
// channel, not just VANTAGE) — findSiblingOdds needs the other channels'
// selections to be present in `match.decisions` to borrow from.
export function flattenArbitrageEntries(
  matches: ChannelDecisionMatchDto[],
): ArbitrageEntry[] {
  return matches.flatMap((match) =>
    match.decisions
      .filter((d) => d.channel === "VANTAGE")
      .map((d) => {
        const selection = d.selections[0];
        const borrowedOdds = selection
          ? findSiblingOdds(match.decisions, selection.market, selection.pick)
          : null;
        return {
          fixtureId: match.fixtureId,
          fixtureStatus: match.fixtureStatus,
          competition: match.competition,
          competitionName: match.competitionName,
          country: match.country,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeLogo: match.homeLogo,
          awayLogo: match.awayLogo,
          kickoff: match.kickoff,
          scheduledAt: match.scheduledAt,
          score: match.score,
          htScore: match.htScore,
          id: d.id,
          status: d.status,
          reasonDetails: d.reasonDetails,
          decidedAt: d.decidedAt,
          selections: d.selections,
          borrowedOdds,
        };
      }),
  );
}

export type ArbitrageCitation = { title: string; url: string };

export type ArbitrageReasonDetails = {
  text: string;
  researchCitations?: ArbitrageCitation[];
};

// Mirrors apps/vantage-worker/src/vantage/persist-decision.ts's
// `reasonDetails = { text, researchCitations }` — the only shape VANTAGE
// ever writes. Defensive like the other reasonDetails parsers in this app
// (parseAvoidOffenders, parseConsensusChannels): a malformed/missing field
// degrades to "nothing to show", never a crash.
export function parseArbitrageReasonDetails(
  raw: unknown,
): ArbitrageReasonDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<ArbitrageReasonDetails>;
  if (typeof d.text !== "string" || d.text.length === 0) return null;
  const citations = Array.isArray(d.researchCitations)
    ? d.researchCitations.filter(
        (c): c is ArbitrageCitation =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as ArbitrageCitation).url === "string" &&
          (c as ArbitrageCitation).url.length > 0,
      )
    : [];
  return { text: d.text, researchCitations: citations };
}

export type ArbitrageVerdict = "play" | "no_play";

// VANTAGE writes SELECTED for a "play" verdict, REJECTED for "no_play" (see
// persist-decision.ts) — the same status field every other channel uses,
// read here with VANTAGE's own two-way meaning instead of the primaries'
// SELECTED/REJECTED/DISABLED/... range.
export function verdictOf(
  entry: Pick<ArbitrageEntry, "status">,
): ArbitrageVerdict {
  return entry.status === "SELECTED" ? "play" : "no_play";
}

export type ArbitrageFilter = "all" | ArbitrageVerdict;

export function matchesFilter(
  entry: Pick<ArbitrageEntry, "status">,
  filter: ArbitrageFilter,
): boolean {
  return filter === "all" || verdictOf(entry) === filter;
}

// hh:mm in the viewer's locale, from an ISO instant — used for "Décidé à
// {time}" under each card, never a full date (the card already carries the
// fixture's own kickoff date via the header).
export function formatDecidedAtTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale === "en" ? "en-GB" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "kicker.de" from "https://www.kicker.de/article/123" — a citation chip
// shows the source's domain, never the full URL (too long, and the path
// carries no signal for a viewer deciding whether to click through).
export function citationDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
