import type {
  ChannelDecisionMatchDto,
  ChannelDecisionMatchDecisionDto,
  StrategyChannel,
  AvoidOffender,
  AvoidReasonDetails,
} from "@/domains/channel-decision/types/channel-decision";

// Channels that express agreement/meta signals rather than a fresh market read.
export const META_CHANNELS: readonly StrategyChannel[] = ["CONSENSUS", "AVOID"];

// AVOID is a negative, fixture-level verdict — it carries no pick.
export function isMetaChannel(channel: StrategyChannel): boolean {
  return META_CHANNELS.includes(channel);
}

export type AvoidFlag = {
  reasonCode: string | null;
  offenders: AvoidOffender[];
};

function parseAvoidDetails(raw: unknown): AvoidOffender[] {
  if (!raw || typeof raw !== "object") return [];
  const d = raw as Partial<AvoidReasonDetails>;
  if (!Array.isArray(d.offenders)) return [];
  return d.offenders.filter(
    (o): o is AvoidOffender =>
      typeof o === "object" &&
      o !== null &&
      typeof o.channel === "string" &&
      typeof o.edge === "number",
  );
}

// The AVOID decision when it fired for this fixture (status SELECTED, no pick).
// A flagged fixture should be visually treated as "skip", overriding its picks.
export function avoidFlag(group: ChannelDecisionMatchDto): AvoidFlag | null {
  const avoid = group.decisions.find((d) => d.channel === "AVOID");
  if (avoid && avoid.status === "SELECTED") {
    return {
      reasonCode: avoid.reasonCode,
      offenders: parseAvoidDetails(avoid.reasonDetails),
    };
  }
  return null;
}

function bestEv(decision: ChannelDecisionMatchDecisionDto): number | null {
  return decision.selections[0]?.ev ?? null;
}

function bestProbability(decision: ChannelDecisionMatchDecisionDto): number {
  return decision.selections[0]?.probability ?? 0;
}

// Decisions that produced a real pick (SELECTED with a selection), AVOID
// excluded (it has none). Ordered to lead with the strongest signal: CONSENSUS
// first (validated agreement), then by EV, then by model probability.
export function selectedPicks(
  group: ChannelDecisionMatchDto,
): ChannelDecisionMatchDecisionDto[] {
  return group.decisions
    .filter(
      (d) =>
        d.channel !== "AVOID" &&
        d.status === "SELECTED" &&
        d.selections.length > 0,
    )
    .sort((a, b) => {
      const aConsensus = a.channel === "CONSENSUS";
      const bConsensus = b.channel === "CONSENSUS";
      if (aConsensus !== bConsensus) return aConsensus ? -1 : 1;
      const aEv = bestEv(a);
      const bEv = bestEv(b);
      if (aEv !== null && bEv !== null && aEv !== bEv) return bEv - aEv;
      if (aEv !== null && bEv === null) return -1;
      if (aEv === null && bEv !== null) return 1;
      return bestProbability(b) - bestProbability(a);
    });
}

// The remaining decisions (rejected / disabled / not-applicable, plus the AVOID
// row itself) — shown collapsed as "evaluated" detail, the de-emphasised noise.
export function evaluatedRest(
  group: ChannelDecisionMatchDto,
): ChannelDecisionMatchDecisionDto[] {
  const picked = new Set(selectedPicks(group).map((d) => d.id));
  return group.decisions.filter(
    (d) => !picked.has(d.id) && d.channel !== "AVOID",
  );
}

export function hasConsensus(group: ChannelDecisionMatchDto): boolean {
  return selectedPicks(group).some((d) => d.channel === "CONSENSUS");
}

// Real pick count (AVOID excluded) — replaces the misleading API selectedCount,
// which counted AVOID flags and double-counted the CONSENSUS meta-duplicate.
export function pickCount(group: ChannelDecisionMatchDto): number {
  return selectedPicks(group).length;
}

// Sort matches by actionability: avoided last, then consensus first, then more
// picks, then best EV, then kickoff — so the decisions that matter rise up.
export function compareMatchesByConviction(
  a: ChannelDecisionMatchDto,
  b: ChannelDecisionMatchDto,
): number {
  const aAvoid = avoidFlag(a) !== null;
  const bAvoid = avoidFlag(b) !== null;
  if (aAvoid !== bAvoid) return aAvoid ? 1 : -1;

  if (hasConsensus(a) !== hasConsensus(b)) return hasConsensus(a) ? -1 : 1;

  const countDiff = pickCount(b) - pickCount(a);
  if (countDiff !== 0) return countDiff;

  const aEv = topEv(a);
  const bEv = topEv(b);
  if (aEv !== bEv) return bEv - aEv;

  return a.kickoff.localeCompare(b.kickoff);
}

function topEv(group: ChannelDecisionMatchDto): number {
  let max = 0;
  for (const d of selectedPicks(group)) {
    const ev = bestEv(d);
    if (ev !== null && ev > max) max = ev;
  }
  return max;
}
