import Decimal from "decimal.js";
import type { DerivedMarketsProba, ThreeWayProba } from "./markets";

// Over/Under probability shrinkage for data-poor leagues.
//
// Diagnosis (docs/data-poor-leagues-calibration.md + NOR2 audit 2026-07-03):
// in leagues without reliable xG the model captures the league's goal LEVEL
// (mean λ is unbiased) but not individual matches — corr(λ_total, actual
// goals) ≈ 0 on every NOR2 season, and the measured calibration slope of the
// O/U lines is ~0.22–0.28 (a 1-point move in predicted probability yields
// only ~a quarter point of real movement). Publishing the raw Poisson O/U
// probability there overstates conviction by construction.
//
// Treatment (piste 2 of the doc, same spirit as rebalanceThreeWayProbabilities
// for 1X2): shrink each full-time O/U probability toward the league's
// empirical base rate, with a per-league factor equal to the measured
// calibration slope:
//
//   over' = base + factor × (over − base);   under' = 1 − over'
//
// factor 1 (or no config) = identity. Base rates come from the recent seasons
// blend (doc lesson: "calibrer sur la fenêtre récente, pas l'historique").
// Scope: full-time O/U lines only — 1X2 has its own empirical blend, BTTS and
// half-time markets are not measured yet.

export type OverUnderShrinkageConfig = {
  // Measured calibration slope of predicted→realized O/U probability.
  factor: number;
  // Empirical over-rates on the recent-seasons blend.
  baseRates: {
    over15: number;
    over25: number;
    over35: number;
    over45: number;
  };
};

// Per-league config. Only leagues with a measured near-zero discriminative
// power belong here — adding a league requires the same audit (calibration
// slope per line + recent base rates from the DB).
export const OU_SHRINKAGE_CONFIG: Record<string, OverUnderShrinkageConfig> = {
  // NOR2 audit 2026-07-03 (746 model runs, 4 seasons): slopes o15 0.22 ·
  // o25 0.22 · o35 0.28 · o45 0.26 → factor 0.25. Base rates blended
  // 2025-26 + 2026-27 (n=304): o15 0.87 · o25 0.66 · o35 0.43 · o45 0.24.
  NOR2: {
    factor: 0.25,
    baseRates: { over15: 0.87, over25: 0.66, over35: 0.43, over45: 0.24 },
  },
};

export function getOverUnderShrinkageConfig(
  competitionCode: string | null | undefined,
): OverUnderShrinkageConfig | null {
  if (!competitionCode) return null;
  return OU_SHRINKAGE_CONFIG[competitionCode] ?? null;
}

type OverUnderProbabilities = ThreeWayProba & DerivedMarketsProba;

export function shrinkOverUnderProbabilities<T extends OverUnderProbabilities>(
  probabilities: T,
  config: OverUnderShrinkageConfig | null,
): T {
  if (config === null || config.factor >= 1) return probabilities;

  const factor = Math.max(0, config.factor);
  const shrink = (over: Decimal, base: number): Decimal => {
    const shrunk = new Decimal(base).plus(
      new Decimal(factor).times(over.minus(base)),
    );
    // Probability invariant [0, 1] — base and factor are config, the model
    // value is already a probability, but clamp defensively.
    return Decimal.max(0, Decimal.min(1, shrunk));
  };

  const over15 = shrink(probabilities.over15, config.baseRates.over15);
  const over25 = shrink(probabilities.over25, config.baseRates.over25);
  const over35 = shrink(probabilities.over35, config.baseRates.over35);
  const over45 = shrink(probabilities.over45, config.baseRates.over45);

  return {
    ...probabilities,
    over15,
    under15: new Decimal(1).minus(over15),
    over25,
    under25: new Decimal(1).minus(over25),
    over35,
    under35: new Decimal(1).minus(over35),
    over45,
    under45: new Decimal(1).minus(over45),
  };
}
