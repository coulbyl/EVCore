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
    // VANTAGE's own selection.odds since 2026-09-04 (persist-decision.ts) —
    // the same value already resolved at generation time for the MIN_ODDS
    // floor check (analyze-fixture.ts's findKnownOdds), the only odds it can
    // honestly claim, never invented. Falls back to a sibling channel's
    // decision on the SAME ModelRun landing on the exact same (market,
    // pick) for decisions persisted before that date, or for markets
    // findKnownOdds doesn't cover yet (only ONE_X_TWO today).
    displayOdds: number | null;
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
        const displayOdds =
          selection?.odds ??
          (selection
            ? findSiblingOdds(match.decisions, selection.market, selection.pick)
            : null);
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
          displayOdds,
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

// Full date + time (viewer's locale), from an ISO instant — used for
// "Décidé le {date}" under each card. Was time-only until 2026-08-30: the
// fixture's own kickoff date in the header made a bare time seem sufficient,
// but VANTAGE can decide up to 48h ahead of kickoff (see apps/vantage-worker's
// sweep LOOKAHEAD_HOURS) — a bare time on a decision made the day before
// kickoff silently misled the viewer about when it actually happened.
export function formatDecidedAt(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === "en" ? "en-GB" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
