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
  // Optional per-market extensions — a block is only present when the same
  // audit (slope + recent base rate) was run for that market in that league.
  // HT/FT and First-Half Winner remain untouched: not measured, and shrinking
  // their components independently would break their internal coherence.
  btts?: { factor: number; baseYes: number };
  ouHt?: {
    factor05: number;
    base05: number;
    factor15: number;
    base15: number;
  };
};

// Per-league config. Only leagues with a measured near-zero discriminative
// power belong here — adding a league requires the same audit (calibration
// slope per line + recent base rates from the DB).
export const OU_SHRINKAGE_CONFIG: Record<string, OverUnderShrinkageConfig> = {
  // NOR2 audit 2026-07-03 (746 model runs, 4 seasons): slopes o15 0.22 ·
  // o25 0.22 · o35 0.28 · o45 0.26 → factor 0.25. Base rates blended
  // 2025-26 + 2026-27 (n=304): o15 0.87 · o25 0.66 · o35 0.43 · o45 0.24.
  // BTTS/HT measured on the same population (n=745, level unbiased):
  // BTTS slope 0.31, recent base yes 0.64; HT O0.5 slope 0.27 base 0.77;
  // HT O1.5 slope 0.37 base 0.42.
  NOR2: {
    factor: 0.25,
    baseRates: { over15: 0.87, over25: 0.66, over35: 0.43, over45: 0.24 },
    btts: { factor: 0.31, baseYes: 0.64 },
    ouHt: { factor05: 0.27, base05: 0.77, factor15: 0.37, base15: 0.42 },
  },
  // Batch audit 2026-07-03 (49 leagues, regr_slope realized~predicted per
  // market). This tranche = the data-poor FAIL list of the doc ∩ audit
  // criteria (n ≥ 400 analyzed, all four O/U slopes < 0.5). Factors = mean
  // of the measured line slopes (O/U) or the market's own slope; negatives
  // clamp to 0 (anti-predictive = publish the base rate).
  // POL1 slopes: o15 0.21 · o25 0.29 · o35 0.43 · o45 0.45 (n=890).
  POL1: {
    factor: 0.35,
    baseRates: { over15: 0.76, over25: 0.51, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.09, baseYes: 0.57 },
    ouHt: { factor05: 0.52, base05: 0.74, factor15: 0.67, base15: 0.37 },
  },
  // POL2 slopes: o15 0.31 · o25 0.43 · o35 0.25 · o45 0.25 (n=897).
  POL2: {
    factor: 0.31,
    baseRates: { over15: 0.8, over25: 0.57, over35: 0.32, over45: 0.15 },
    btts: { factor: 0.32, baseYes: 0.59 },
    ouHt: { factor05: 0, base05: 0.73, factor15: 0.4, base15: 0.4 },
  },
  // FIN1 slopes: o15 0.11 · o25 0.13 · o35 0.47 · o45 0.40 (n=526).
  FIN1: {
    factor: 0.28,
    baseRates: { over15: 0.83, over25: 0.66, over35: 0.44, over45: 0.26 },
    btts: { factor: 0.3, baseYes: 0.64 },
    ouHt: { factor05: 0.31, base05: 0.72, factor15: 0.05, base15: 0.4 },
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
  if (config === null) return probabilities;

  const over15 = shrinkWith(
    probabilities.over15,
    config.baseRates.over15,
    config.factor,
  );
  const over25 = shrinkWith(
    probabilities.over25,
    config.baseRates.over25,
    config.factor,
  );
  const over35 = shrinkWith(
    probabilities.over35,
    config.baseRates.over35,
    config.factor,
  );
  const over45 = shrinkWith(
    probabilities.over45,
    config.baseRates.over45,
    config.factor,
  );

  const result: T = {
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

  if (config.btts) {
    const bttsYes = shrinkWith(
      probabilities.bttsYes,
      config.btts.baseYes,
      config.btts.factor,
    );
    result.bttsYes = bttsYes;
    result.bttsNo = new Decimal(1).minus(bttsYes);
  }

  if (config.ouHt) {
    const shrunkOuHt = { ...probabilities.ouHT };
    const over05 = probabilities.ouHT.OVER_0_5;
    if (over05 !== undefined) {
      const s = shrinkWith(over05, config.ouHt.base05, config.ouHt.factor05);
      shrunkOuHt.OVER_0_5 = s;
      if (probabilities.ouHT.UNDER_0_5 !== undefined) {
        shrunkOuHt.UNDER_0_5 = new Decimal(1).minus(s);
      }
    }
    const over15Ht = probabilities.ouHT.OVER_1_5;
    if (over15Ht !== undefined) {
      const s = shrinkWith(over15Ht, config.ouHt.base15, config.ouHt.factor15);
      shrunkOuHt.OVER_1_5 = s;
      if (probabilities.ouHT.UNDER_1_5 !== undefined) {
        shrunkOuHt.UNDER_1_5 = new Decimal(1).minus(s);
      }
    }
    result.ouHT = shrunkOuHt;
  }

  return result;
}

// p' = base + factor × (p − base), factor clamped to [0, 1] (1 = identity,
// never amplify), result clamped to the probability invariant [0, 1].
function shrinkWith(over: Decimal, base: number, factor: number): Decimal {
  const f = Math.min(1, Math.max(0, factor));
  const shrunk = new Decimal(base).plus(new Decimal(f).times(over.minus(base)));
  return Decimal.max(0, Decimal.min(1, shrunk));
}
