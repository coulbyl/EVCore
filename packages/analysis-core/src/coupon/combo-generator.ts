import Decimal from "decimal.js";

/**
 * Combiné du jour v2 sur les sélections du moteur (jusqu'au 2026-11-04,
 * remplacé par `composeReadingCombo` : le combiné part désormais des
 * lectures). Gardé pour son rejeu (backtest-engine-combo-margin.ts). Reproduit exactement la sélection mise en avant par l'écran
 * Décisions (`primaryPick`, apps/web) — même pastille de confiance, mêmes
 * paliers — puis en garde une par championnat, les championnats dans
 * l'ordre de leur jambe la moins chère ; dans chacun, à chance égale, la
 * marge 1xBet la plus basse (`marginTieBreak`).
 */
export type ComboCandidate = {
  fixtureId: string;
  competition: string;
  channel: string;
  market: string;
  pick: string;
  odds: number;
  probability: number;
  /**
   * Marge payée chez le book des joueurs (1xBet) sur le groupe d'issues du
   * choix ; null ou absente quand le book ne cote pas tout le groupe.
   */
  margin?: number | null;
  /**
   * Fréquence sans marge du choix chez ce book (Shin, même relevé que
   * `margin`) ; null ou absente si le groupe est incomplet.
   */
  fairProbability?: number | null;
};

/** Calibration d'un canal sur une compétition : réel / annoncé et volume. */
export type CalibrationCell = {
  channel: string;
  competition: string;
  sampleSize: number;
  ratio: number | null;
};

export type ComboConfig = {
  legs: number;
  minLegOdds: number;
  maxLegOdds: number;
  /** Volume minimal pour qu'une cellule ait un statut (sinon « non mesuré »). */
  minSample: number;
  goodRatio: number;
  badRatio: number;
  /**
   * Départage par la marge : dans un championnat, parmi les jambes dont la
   * probabilité est à `window` près de celle de la jambe la moins chère, la
   * marge connue la plus basse. Absent : la moins chère.
   */
  marginTieBreak?: { window: number };
};

export const COMBO_CONFIG: ComboConfig = {
  // Bande du v2, figée : la classe du combiné porte désormais celle des
  // lectures (COMBO_COUPON_CLASS, 2026-11-05).
  legs: 2,
  minLegOdds: 1.2,
  maxLegOdds: 1.5,
  minSample: 30,
  goodRatio: 0.85,
  badRatio: 0.7,
  // 2026-11-03, rejeu sur 49 jours de prix 1xBet (docs/audits/2026-11-03/
  // COMBINE-MARGE.md) : marge payée par jambe 8,93 % → 8,52 %, réalisé ÷
  // annoncé 1,020 → 1,028 (dans le bruit), dans les deux moitiés.
  marginTieBreak: { window: 0.02 },
};

export type ComboSelection =
  | { outcome: "picked"; legs: ComboCandidate[]; candidateCount: number }
  | {
      outcome: "abstained";
      reason: "not_enough_calibrated_short_legs";
      candidateCount: number;
    };

type Status = "GREEN" | "ORANGE" | "RED" | "NA";

function statusOf(
  cell: CalibrationCell | undefined,
  config: ComboConfig,
): Status {
  if (!cell || cell.sampleSize < config.minSample || cell.ratio === null) {
    return "NA";
  }
  if (cell.ratio >= config.goodRatio) return "GREEN";
  if (cell.ratio >= config.badRatio) return "ORANGE";
  return "RED";
}

/** Même ordre que `primaryPick` côté web : fiable et court, puis non
 * « peu fiable » et court, puis les mêmes sans contrainte de cote. */
function tier(status: Status, odds: number, config: ComboConfig): number {
  const cheap = odds < config.maxLegOdds;
  if (status === "GREEN" && cheap) return 0;
  if (status !== "RED" && cheap) return 1;
  if (status === "GREEN") return 2;
  if (status !== "RED") return 3;
  return 4;
}

/**
 * Les jambes éligibles à un combiné, dans l'ordre où le compositeur les
 * prend : la sélection mise en avant de chaque match (palier, puis
 * probabilité, puis cote — l'ordre de l'écran Décisions), gardée seulement
 * si elle est calibrée et courte (palier 0 ou 1), classée par cote
 * croissante. Partagée entre le combiné du moteur (qui en prend trois, une
 * par championnat) et le combiné LLM (qui en reçoit la liste et en choisit
 * trois) : les deux partent du même vivier, c'est ce qui rend leurs jambes
 * comparables.
 */
export function eligibleComboLegs(
  candidates: readonly ComboCandidate[],
  calibration: readonly CalibrationCell[],
  config: ComboConfig = COMBO_CONFIG,
): ComboCandidate[] {
  const cells = new Map(
    calibration.map((c) => [`${c.channel}:${c.competition}`, c]),
  );
  type Scored = ComboCandidate & { tier: number };
  const scored: Scored[] = candidates
    .filter((c) => Number.isFinite(c.odds) && c.odds >= config.minLegOdds)
    .map((c) => ({
      ...c,
      tier: tier(
        statusOf(cells.get(`${c.channel}:${c.competition}`), config),
        c.odds,
        config,
      ),
    }));

  const primaryByFixture = new Map<string, Scored>();
  for (const c of scored) {
    const held = primaryByFixture.get(c.fixtureId);
    if (
      !held ||
      c.tier < held.tier ||
      (c.tier === held.tier &&
        (c.probability > held.probability ||
          (c.probability === held.probability && c.odds < held.odds)))
    ) {
      primaryByFixture.set(c.fixtureId, c);
    }
  }

  return [...primaryByFixture.values()]
    .filter((c) => c.tier <= 1)
    .sort(
      (a, b) =>
        a.odds - b.odds ||
        b.probability - a.probability ||
        a.fixtureId.localeCompare(b.fixtureId),
    )
    .map((c) => ({
      fixtureId: c.fixtureId,
      competition: c.competition,
      channel: c.channel,
      market: c.market,
      pick: c.pick,
      odds: c.odds,
      probability: c.probability,
      ...(c.margin === undefined ? {} : { margin: c.margin }),
      ...(c.fairProbability === undefined
        ? {}
        : { fairProbability: c.fairProbability }),
    }));
}

/** `value` est-il à `window` au plus sous `reference` ? En Decimal. */
function withinWindowBelow(input: {
  value: number;
  reference: number;
  window: number;
}): boolean {
  return new Decimal(input.value).gte(
    new Decimal(input.reference).minus(input.window),
  );
}

/**
 * La jambe la moins chère du groupe (le premier, trié par cote croissante),
 * ou, parmi celles à chance égale, la marge connue la plus basse. « Chance
 * égale » se lit deux fois : probabilité du moteur ET fréquence sans marge du
 * marché à `window` près de celles de la moins chère — le moteur seul
 * laisserait passer une jambe plus longue où il s'écarte du prix (l'écart
 * annoncé est anti-prédictif). Une marge ou une fréquence inconnue ne
 * départage jamais ; à marge égale, la moins chère.
 */
function lowestMarginAmongTies(
  group: readonly ComboCandidate[],
  window: number,
): ComboCandidate | undefined {
  const head = group[0];
  if (!head) return undefined;
  const headFair = head.fairProbability;
  if (headFair == null) return head;
  let best: { leg: ComboCandidate; margin: number } | null = null;
  for (const c of group) {
    const margin = c.margin;
    const fair = c.fairProbability;
    if (margin == null || !Number.isFinite(margin) || fair == null) continue;
    const tied =
      withinWindowBelow({
        value: c.probability,
        reference: head.probability,
        window,
      }) && withinWindowBelow({ value: fair, reference: headFair, window });
    if (!tied) continue;
    if (best === null || margin < best.margin) best = { leg: c, margin };
  }
  return best?.leg ?? head;
}

export function composeEngineCombo(
  candidates: readonly ComboCandidate[],
  calibration: readonly CalibrationCell[],
  config: ComboConfig = COMBO_CONFIG,
): ComboSelection {
  const eligible = eligibleComboLegs(candidates, calibration, config);

  // Une par championnat, les championnats dans l'ordre de leur jambe la
  // moins chère ; dans chacun, la moins chère ou, avec le départage, la
  // marge la plus basse à chance égale.
  const byCompetition = new Map<string, ComboCandidate[]>();
  for (const c of eligible) {
    const group = byCompetition.get(c.competition) ?? [];
    group.push(c);
    byCompetition.set(c.competition, group);
  }
  const legs: ComboCandidate[] = [];
  for (const group of byCompetition.values()) {
    const leg = config.marginTieBreak
      ? lowestMarginAmongTies(group, config.marginTieBreak.window)
      : group[0];
    if (leg) legs.push(leg);
    if (legs.length === config.legs) break;
  }

  if (legs.length < config.legs) {
    return {
      outcome: "abstained",
      reason: "not_enough_calibrated_short_legs",
      candidateCount: eligible.length,
    };
  }
  return { outcome: "picked", legs, candidateCount: eligible.length };
}
