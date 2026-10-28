import Decimal from "decimal.js";
import { priceOutcomeGroups } from "../pricing/market-probability";
import type { CalibrationCell, ComboCandidate } from "./combo-generator";
import {
  HUNTER_BTTS_CLASS,
  HUNTER_DRAW_CLASS,
  type CouponClass,
} from "./coupon-classes";
import type { DoubleCandidate } from "./double-composer";

/**
 * Chasseurs (2026-10-28, en ombre) : un produit par marché, une sélection
 * par jour dans la bande de cote du marché, ou l'abstention. Jamais d'edge
 * (le filtre le plus perdant mesuré). Deux classements tournent côte à côte
 * pour être jugés jambe par jambe sur l'écart au marché :
 *
 * - par le prix (`composeHunterByMarket`) : tout ce qui est coté sur le
 *   marché, classé par la probabilité du marché sans marge, puis la marge
 *   la plus basse — la méthode du coupon cote 2 ;
 * - par le moteur (`composeHunterByEngine`) : les sélections du canal du
 *   jour, classées par la probabilité du canal recalée sur sa calibration
 *   canal × compétition, sans les cellules « peu fiables » — la méthode de
 *   Notre sélection, qui bat le marché de 2,7 points sur la sélection
 *   principale (NOTRE-SELECTION.md).
 */

export type HunterSpec = {
  coupon: CouponClass;
  market: string;
  pick: string;
  channel: string;
};

export const BTTS_HUNTER: HunterSpec = {
  coupon: HUNTER_BTTS_CLASS,
  market: "BTTS",
  pick: "YES",
  channel: "BTTS",
};

export const DRAW_HUNTER: HunterSpec = {
  coupon: HUNTER_DRAW_CLASS,
  market: "ONE_X_TWO",
  pick: "DRAW",
  channel: "DRAW",
};

export const HUNTERS: readonly HunterSpec[] = [BTTS_HUNTER, DRAW_HUNTER];

/** Même volume et mêmes seuils que le combiné (combo-generator.ts). */
const MIN_CALIBRATION_SAMPLE = 30;
const BAD_RATIO = 0.7;

export type HunterLeg = {
  fixtureId: string;
  market: string;
  pick: string;
  /** Cote de référence de la sélection. */
  odds: number;
  /**
   * Probabilité annoncée par la variante : celle du marché (prix) ou celle
   * du canal, non recalée (moteur), pour que le règlement compare chaque
   * variante à ce qu'elle annonce.
   */
  probability: number;
};

export type HunterComposition =
  | { outcome: "picked"; leg: HunterLeg; candidateCount: number }
  | {
      outcome: "abstained";
      reason: "no_candidate_in_band";
      candidateCount: number;
    };

function inBand(odds: number, spec: HunterSpec): boolean {
  return odds >= spec.coupon.minLegOdds && odds <= spec.coupon.maxLegOdds;
}

export function composeHunterByMarket(
  candidates: readonly DoubleCandidate[],
  spec: HunterSpec,
): HunterComposition {
  const legs = priceOutcomeGroups(candidates).filter(
    (leg) =>
      leg.market === spec.market &&
      leg.pick === spec.pick &&
      inBand(leg.playableOdds, spec),
  );
  let best: (typeof legs)[number] | null = null;
  for (const leg of legs) {
    if (
      !best ||
      leg.fair.gt(best.fair) ||
      (leg.fair.eq(best.fair) && leg.margin.lt(best.margin))
    ) {
      best = leg;
    }
  }
  if (!best) {
    return {
      outcome: "abstained",
      reason: "no_candidate_in_band",
      candidateCount: 0,
    };
  }
  return {
    outcome: "picked",
    leg: {
      fixtureId: best.fixtureId,
      market: best.market,
      pick: best.pick,
      odds: best.odds,
      probability: best.fair.toNumber(),
    },
    candidateCount: legs.length,
  };
}

export function composeHunterByEngine(
  candidates: readonly ComboCandidate[],
  calibration: readonly CalibrationCell[],
  spec: HunterSpec,
): HunterComposition {
  const cells = new Map(
    calibration.map((c) => [`${c.channel}:${c.competition}`, c]),
  );
  const scored = candidates
    .filter(
      (c) =>
        c.channel === spec.channel &&
        c.market === spec.market &&
        c.pick === spec.pick &&
        inBand(c.odds, spec),
    )
    .flatMap((c) => {
      const cell = cells.get(`${c.channel}:${c.competition}`);
      const measured =
        cell !== undefined &&
        cell.ratio !== null &&
        cell.sampleSize >= MIN_CALIBRATION_SAMPLE;
      // « Peu fiable » sur la compétition : exclu, comme du combiné.
      if (measured && cell.ratio !== null && cell.ratio < BAD_RATIO) return [];
      const ratio = measured && cell.ratio !== null ? cell.ratio : 1;
      return [
        {
          candidate: c,
          calibrated: new Decimal(c.probability).times(ratio),
        },
      ];
    });
  let best: (typeof scored)[number] | null = null;
  for (const row of scored) {
    if (
      !best ||
      row.calibrated.gt(best.calibrated) ||
      (row.calibrated.eq(best.calibrated) &&
        row.candidate.odds < best.candidate.odds)
    ) {
      best = row;
    }
  }
  if (!best) {
    return {
      outcome: "abstained",
      reason: "no_candidate_in_band",
      candidateCount: 0,
    };
  }
  const { candidate } = best;
  return {
    outcome: "picked",
    leg: {
      fixtureId: candidate.fixtureId,
      market: candidate.market,
      pick: candidate.pick,
      odds: candidate.odds,
      probability: candidate.probability,
    },
    candidateCount: scored.length,
  };
}
