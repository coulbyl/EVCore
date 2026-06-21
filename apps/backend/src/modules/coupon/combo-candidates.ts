import {
  COMBO_WHITELIST,
  buildPoissonDistributions,
  calculateEV,
  computeJointProbability,
  computePoissonMarkets,
  type ComboPick,
} from '@modules/betting-engine/betting-engine.utils';
import {
  estimateComboOdds,
  getPickOddsFromSnapshot,
} from '@modules/betting-engine/pricing/odds-mapping';
import type { FullOddsSnapshot } from '@modules/betting-engine/betting-engine.types';

/**
 * Same-match combo candidate (DESIGN.md Étape 6) — two correlated markets of one
 * fixture. Joint probability comes from the bivariate Poisson (NEVER `p1 × p2`);
 * combined odds are the correlation-damped product (`estimateComboOdds`); EV uses
 * the canonical `calculateEV`. Only positive-edge combos above the league
 * threshold are returned.
 */
export type ComboCandidate = {
  combo: ComboPick;
  jointProbability: number;
  combinedOdds: number;
  ev: number;
};

/**
 * Builds whitelisted same-match combo candidates for one fixture, keeping only
 * those whose joint EV clears `evThreshold` (the league EV gate). Combos whose
 * markets aren't both priced in the snapshot are skipped (no invented odds).
 */
export function buildComboCandidates(input: {
  lambdaHome: number;
  lambdaAway: number;
  snapshot: FullOddsSnapshot;
  evThreshold: number;
}): ComboCandidate[] {
  const { lambdaHome, lambdaAway, snapshot, evThreshold } = input;
  const probabilities = computePoissonMarkets(lambdaHome, lambdaAway);
  const { distHome, distAway } = buildPoissonDistributions(
    lambdaHome,
    lambdaAway,
  );

  const candidates: ComboCandidate[] = [];
  for (const combo of COMBO_WHITELIST) {
    const odds1 = getPickOddsFromSnapshot(combo.market1, combo.pick1, snapshot);
    const odds2 = getPickOddsFromSnapshot(combo.market2, combo.pick2, snapshot);
    if (odds1 === null || odds2 === null) continue;

    const jointProbability = computeJointProbability(combo, distHome, distAway);
    if (jointProbability.lte(0)) continue;

    const combinedOdds = estimateComboOdds({
      combo,
      probabilities,
      jointProbability,
      odds1,
      odds2,
    });
    const ev = calculateEV(jointProbability, combinedOdds);
    if (ev.lt(evThreshold)) continue;

    candidates.push({
      combo,
      jointProbability: jointProbability.toNumber(),
      combinedOdds: combinedOdds.toNumber(),
      ev: ev.toNumber(),
    });
  }
  return candidates;
}

/** Label for a combo leg's secondary market, e.g. `BTTS/YES`. */
export function comboLegLabel(combo: ComboPick): string {
  return `${combo.market2}/${combo.pick2}`;
}
