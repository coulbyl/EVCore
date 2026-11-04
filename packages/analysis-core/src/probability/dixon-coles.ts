/**
 * Dixon-Coles low-score dependence (Dixon & Coles 1997): the independent
 * Poisson cell P(h) × P(a) is multiplied by τ(h, a) on the four scores
 * 0-0, 0-1, 1-0 and 1-1, every other cell unchanged.
 *
 *   τ(0,0) = 1 − λh·λa·ρ   τ(0,1) = 1 + λh·ρ
 *   τ(1,0) = 1 + λa·ρ      τ(1,1) = 1 − ρ
 *
 * Both marginals are preserved exactly (P(a = 1) = λa·P(a = 0) in a Poisson
 * law, the λ-terms cancel row by row), so team totals, clean sheets and the
 * half-time markets read off the marginals do not move; the draw, the low
 * totals, BTTS and the exact scores do. ρ < 0 adds mass to 0-0 and 1-1.
 *
 * Sub-model D of lot ML-2 (docs/audits/2026-11-04/ML2A-DEPENDANCE-BUTS.md):
 * applied only to the market grid, with a per-league ρ.
 */
export type GoalDependence = {
  rho: number;
  lambdaHome: number;
  lambdaAway: number;
};

/**
 * ρ clamped to the range where every τ stays ≥ 0 for these λ (a negative
 * cell is not a probability).
 */
export function boundedDixonColesRho(dependence: GoalDependence): number {
  const { rho, lambdaHome, lambdaAway } = dependence;
  const lower = Math.max(-1 / lambdaHome, -1 / lambdaAway);
  const upper = Math.min(1, 1 / (lambdaHome * lambdaAway));
  return Math.min(upper, Math.max(lower, rho));
}

/** τ(h, a) of `dependence` (ρ already bounded by the caller). */
export function dixonColesTau(
  h: number,
  a: number,
  dependence: GoalDependence,
): number {
  const { rho, lambdaHome, lambdaAway } = dependence;
  if (rho === 0 || h > 1 || a > 1) return 1;
  if (h === 0 && a === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (h === 0) return 1 + lambdaHome * rho;
  if (a === 0) return 1 + lambdaAway * rho;
  return 1 - rho;
}
