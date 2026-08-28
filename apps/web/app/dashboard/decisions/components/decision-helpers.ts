import type {
  ChannelDecisionMatchDto,
  ChannelDecisionMatchDecisionDto,
  StrategyChannel,
  AvoidOffender,
  AvoidReasonDetails,
  ConsensusReasonDetails,
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
 */
export function isExcludedFromDecisions(channel: StrategyChannel): boolean {
  return channel === "VANTAGE";
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
 * Les méta-canaux restent des signaux au niveau du match : CONSENSUS dans
 * l'en-tête de la carte, AVOID en bandeau.
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

/**
 * Canaux indépendants qui convergent sur ce match, ou liste vide.
 *
 * Lit `reasonDetails`, PAS les sélections : depuis le 2026-08-22 CONSENSUS
 * n'émet plus de pick (ses 765 sélections étaient des doublons exacts, et sa
 * probabilité — le maximum des canaux d'accord — était biaisée vers le haut
 * par construction). Le niveau d'accord reste publié dans `reasonDetails`,
 * et c'est désormais la seule trace exploitable.
 *
 * Le test précédent exigeait `selections.length > 0`. Il passait encore
 * uniquement parce qu'aucun run n'avait tourné depuis le changement : au
 * premier run suivant, le badge et la liste des canaux convergents auraient
 * disparu de l'app sans que rien ne le signale.
 */
export function consensusChannels(
  group: ChannelDecisionMatchDto,
): StrategyChannel[] {
  const consensus = group.decisions.find(
    (d) => d.channel === "CONSENSUS" && d.status === "SELECTED",
  );
  if (!consensus) return [];
  const raw = consensus.reasonDetails;
  if (!raw || typeof raw !== "object") return [];
  const details = raw as Partial<ConsensusReasonDetails>;
  return Array.isArray(details.channels)
    ? details.channels.filter(
        (c): c is StrategyChannel => typeof c === "string",
      )
    : [];
}

export function hasConsensus(group: ChannelDecisionMatchDto): boolean {
  return consensusChannels(group).length > 0;
}
