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

// Decisions that produced a real market pick (SELECTED with a selection).
// Meta-channels stay fixture-level signals: CONSENSUS is shown in the card
// header, and AVOID is shown as a banner.
export function selectedPicks(
  group: ChannelDecisionMatchDto,
): ChannelDecisionMatchDecisionDto[] {
  return group.decisions
    .filter(
      (d) =>
        !isMetaChannel(d.channel) &&
        d.status === "SELECTED" &&
        d.selections.length > 0,
    )
    .sort((a, b) => {
      const aEv = bestEv(a);
      const bEv = bestEv(b);
      if (aEv !== null && bEv !== null && aEv !== bEv) return bEv - aEv;
      if (aEv !== null && bEv === null) return -1;
      if (aEv === null && bEv !== null) return 1;
      return bestProbability(b) - bestProbability(a);
    });
}

// The remaining primary-channel decisions (rejected / disabled /
// not-applicable) — shown collapsed as "evaluated" detail.
export function evaluatedRest(
  group: ChannelDecisionMatchDto,
): ChannelDecisionMatchDecisionDto[] {
  const picked = new Set(selectedPicks(group).map((d) => d.id));
  return group.decisions.filter(
    (d) => !picked.has(d.id) && !isMetaChannel(d.channel),
  );
}

export function hasConsensus(group: ChannelDecisionMatchDto): boolean {
  return group.decisions.some(
    (d) =>
      d.channel === "CONSENSUS" &&
      d.status === "SELECTED" &&
      d.selections.length > 0,
  );
}
