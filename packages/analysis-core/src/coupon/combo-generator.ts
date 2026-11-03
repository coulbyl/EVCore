import { COMBO_COUPON_CLASS, LONG_COUPON_CLASS } from "./coupon-classes";

/**
 * Combiné du jour sur les sélections du moteur (voir COMBO_COUPON_CLASS pour
 * la mesure). Reproduit exactement la sélection mise en avant par l'écran
 * Décisions (`primaryPick`, apps/web) — même pastille de confiance, mêmes
 * paliers — puis en garde trois, une par championnat, les moins chères
 * d'abord.
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
  legs: COMBO_COUPON_CLASS.maxLegs,
  minLegOdds: COMBO_COUPON_CLASS.minLegOdds,
  maxLegOdds: COMBO_COUPON_CLASS.maxLegOdds,
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
    }));
}

/**
 * La jambe la moins chère du groupe (le premier, trié par cote croissante),
 * ou, parmi celles dont la probabilité est à `window` près de la sienne, la
 * marge connue la plus basse. Une marge inconnue ne gagne jamais contre une
 * marge connue ; à marge égale, la moins chère.
 */
function lowestMarginAmongTies(
  group: readonly ComboCandidate[],
  window: number,
): ComboCandidate | undefined {
  const head = group[0];
  if (!head) return undefined;
  let best: ComboCandidate | null = null;
  for (const c of group) {
    if (c.margin == null || !Number.isFinite(c.margin)) continue;
    if (c.probability < head.probability - window) continue;
    if (best === null || c.margin < (best.margin as number)) best = c;
  }
  return best ?? head;
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

export type LongConfig = {
  minLegOdds: number;
  maxLegOdds: number;
  maxLegs: number;
  targetOdds: number;
  maxOdds: number;
  minSample: number;
  goodRatio: number;
  badRatio: number;
};

export const LONG_CONFIG: LongConfig = {
  minLegOdds: LONG_COUPON_CLASS.minLegOdds,
  maxLegOdds: LONG_COUPON_CLASS.maxLegOdds,
  maxLegs: LONG_COUPON_CLASS.maxLegs,
  targetOdds: LONG_COUPON_CLASS.targetCombinedOdds,
  maxOdds: LONG_COUPON_CLASS.targetOddsMax,
  minSample: COMBO_CONFIG.minSample,
  goodRatio: COMBO_CONFIG.goodRatio,
  badRatio: COMBO_CONFIG.badRatio,
};

export type LongSelection =
  | { outcome: "picked"; legs: ComboCandidate[]; candidateCount: number }
  | {
      outcome: "abstained";
      reason: "target_unreachable";
      candidateCount: number;
    };

/**
 * Le coupon long (voir LONG_COUPON_CLASS) : la sélection mise en avant de
 * chaque match quand son canal n'est pas « peu fiable » sur la compétition
 * et que sa cote est entre 1,20 et 1,80, une par championnat, les plus
 * longues d'abord, ajoutées jusqu'à atteindre la cible. Abstention si la
 * cible n'est pas atteinte en `maxLegs` jambes ou dépasse le plafond.
 */
export function composeEngineLong(
  candidates: readonly ComboCandidate[],
  calibration: readonly CalibrationCell[],
  config: LongConfig = LONG_CONFIG,
): LongSelection {
  const cells = new Map(
    calibration.map((c) => [`${c.channel}:${c.competition}`, c]),
  );
  const comboConfig: ComboConfig = {
    legs: config.maxLegs,
    minLegOdds: config.minLegOdds,
    maxLegOdds: config.maxLegOdds,
    minSample: config.minSample,
    goodRatio: config.goodRatio,
    badRatio: config.badRatio,
  };
  type Scored = ComboCandidate & { tier: number };
  const scored: Scored[] = candidates
    .filter(
      (c) =>
        Number.isFinite(c.odds) &&
        c.odds >= config.minLegOdds &&
        c.odds <= config.maxLegOdds,
    )
    .map((c) => ({
      ...c,
      tier: tier(
        statusOf(cells.get(`${c.channel}:${c.competition}`), comboConfig),
        c.odds,
        comboConfig,
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
  // Canal « peu fiable » exclu (palier 4) ; les plus longues d'abord.
  const eligible = [...primaryByFixture.values()]
    .filter((c) => c.tier <= 3)
    .sort(
      (a, b) =>
        b.odds - a.odds ||
        b.probability - a.probability ||
        a.fixtureId.localeCompare(b.fixtureId),
    );

  const legs: ComboCandidate[] = [];
  const competitions = new Set<string>();
  let combined = 1;
  for (const c of eligible) {
    if (competitions.has(c.competition)) continue;
    if (combined * c.odds > config.maxOdds) continue;
    competitions.add(c.competition);
    legs.push({
      fixtureId: c.fixtureId,
      competition: c.competition,
      channel: c.channel,
      market: c.market,
      pick: c.pick,
      odds: c.odds,
      probability: c.probability,
    });
    combined *= c.odds;
    if (combined >= config.targetOdds || legs.length === config.maxLegs) break;
  }
  if (combined < config.targetOdds) {
    return {
      outcome: "abstained",
      reason: "target_unreachable",
      candidateCount: eligible.length,
    };
  }
  return { outcome: "picked", legs, candidateCount: eligible.length };
}
