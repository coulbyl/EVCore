import type {
  ChannelDecisionMatchDto,
  ChannelDecisionMatchDecisionDto,
  StrategyChannel,
  AvoidOffender,
  AvoidReasonDetails,
} from "@/domains/channel-decision/types/channel-decision";

/**
 * Méta-canaux : ils lisent les décisions des autres au lieu de prendre une
 * position propre, donc ils n'émettent aucun pick et ne sont jamais ajoutables
 * à un coupon.
 *
 * Source unique — cette liste était dupliquée dans channel-row.tsx sous le
 * même nom avec un contenu différent.
 */
export const META_CHANNELS: ReadonlySet<StrategyChannel> = new Set([
  "CONSENSUS",
  "CONTRARIAN",
  "AVOID",
]);

export function isMetaChannel(channel: StrategyChannel): boolean {
  return META_CHANNELS.has(channel);
}

/**
 * VANTAGE has its own dedicated page (/dashboard/arbitrage, "Arbitrage" in
 * the UI) since 2026-08-28 — excluded from both Decisions lenses so its full
 * LLM reasoning isn't flattened into a bare pick chip here, duplicating a
 * much richer read available one click away. Not a META_CHANNEL: unlike
 * AVOID/CONSENSUS it does emit real picks, it's just not shown on this page.
 *
 * VALUE/SAFE excluded since 2026-09-03: disconnected from the live pipeline
 * (docs/vantage-centric-redesign-2026-09-01.md §5.1) — 92%/95% of their
 * picks exactly duplicate a Phase-1 channel's pick, and their own "unique"
 * picks don't hold up in calibration on a larger sample either (ratio 0.69,
 * n≈1822, vs the small n=173/+14.1% ROI an earlier audit found — didn't
 * replicate). They keep computing (`channel_decision`/`channel_selection`)
 * for observation, just not shown here as an actionable pick anymore.
 */
export function isExcludedFromDecisions(channel: StrategyChannel): boolean {
  return channel === "VANTAGE" || channel === "VALUE" || channel === "SAFE";
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

function bestProbability(decision: ChannelDecisionMatchDecisionDto): number {
  return decision.selections[0]?.probability ?? 0;
}

/**
 * Décisions ayant produit un vrai pick de marché (SELECTED avec sélection),
 * classées par probabilité décroissante.
 *
 * Le tri était par EV décroissante jusqu'au 2026-08-22. Mesuré au niveau
 * coupon, le tri par EV perd contre le tri par probabilité dans 13
 * configurations appariées sur 16, et hors échantillon −25.94% contre
 * −6.57% : c'est le critère qu'Investir a cessé d'utiliser le même jour.
 * Garder l'EV ici aurait mis en avant, sur la fiche de match, exactement ce
 * que la page de mise ne classe plus.
 *
 * AVOID reste un signal au niveau du match (bandeau) — CONSENSUS n'en est
 * plus un depuis le 2026-09-03 (badge retiré : sa probabilité annoncée,
 * maximum des canaux d'accord, était mesurée mal calibrée — ratio réel/
 * annoncé 0,74 sur 412 réglés, 0,18 sur son dernier vrai lot avant que sa
 * sélection ne devienne quasi nulle — voir docs/vantage-centric-redesign-
 * 2026-09-01.md §5.6).
 */
export function selectedPicks(
  group: ChannelDecisionMatchDto,
): ChannelDecisionMatchDecisionDto[] {
  return group.decisions
    .filter(
      (d) =>
        !isMetaChannel(d.channel) &&
        !isExcludedFromDecisions(d.channel) &&
        d.status === "SELECTED" &&
        d.selections.length > 0,
    )
    .sort((a, b) => bestProbability(b) - bestProbability(a));
}

// The remaining primary-channel decisions (rejected / disabled /
// not-applicable) — shown collapsed as "evaluated" detail.
export function evaluatedRest(
  group: ChannelDecisionMatchDto,
): ChannelDecisionMatchDecisionDto[] {
  const picked = new Set(selectedPicks(group).map((d) => d.id));
  return group.decisions.filter(
    (d) =>
      !picked.has(d.id) &&
      !isMetaChannel(d.channel) &&
      !isExcludedFromDecisions(d.channel),
  );
}
