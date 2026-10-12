import { COMBO_COUPON_CLASS } from "./coupon-classes";

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
};

export const COMBO_CONFIG: ComboConfig = {
  legs: COMBO_COUPON_CLASS.maxLegs,
  minLegOdds: COMBO_COUPON_CLASS.minLegOdds,
  maxLegOdds: COMBO_COUPON_CLASS.maxLegOdds,
  minSample: 30,
  goodRatio: 0.85,
  badRatio: 0.7,
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

export function composeEngineCombo(
  candidates: readonly ComboCandidate[],
  calibration: readonly CalibrationCell[],
  config: ComboConfig = COMBO_CONFIG,
): ComboSelection {
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

  // La sélection mise en avant de chaque match : palier, puis probabilité,
  // puis cote — l'ordre de l'écran.
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

  // Seules les sélections calibrées et courtes entrent dans un combiné.
  const eligible = [...primaryByFixture.values()]
    .filter((c) => c.tier <= 1)
    .sort(
      (a, b) =>
        a.odds - b.odds ||
        b.probability - a.probability ||
        a.fixtureId.localeCompare(b.fixtureId),
    );

  // Une par championnat, les moins chères d'abord.
  const legs: ComboCandidate[] = [];
  const competitions = new Set<string>();
  for (const c of eligible) {
    if (competitions.has(c.competition)) continue;
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
