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
// Scope: full-time O/U lines + BTTS + HT O/U where measured (see the
// per-league blocks) — 1X2 keeps its own empirical blend; HT/FT and
// First-Half Winner are untouched (shrinking components would break their
// internal coherence).

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

// Per-league config — GENERATED from the forward-validated batch backtest
// (2026-07-03, see docs/data-poor-leagues-calibration.md). Shipping rule per
// block: held-out Brier improves by ≥ 0.001 (train = all seasons but the
// most recent; test = the most recent). Factors are then re-fitted on the
// full sample; base rates come from the 2 most recent seasons. `factor: 1`
// = O/U identity (only the btts/ouHt blocks of that league shipped).
// Staked-picks guard on 910 settled SAFE/VALUE O/U picks: the picks this
// config drops ran at −15.6% ROI; kept picks 0.0%; untouched leagues +10.6%.
export const OU_SHRINKAGE_CONFIG: Record<string, OverUnderShrinkageConfig> = {
  // BRA1: full-sample slopes o15 0.08 · o25 0.18 · o35 0.00 · o45 0.10; forward ΔBrier OU -0.0045 (4/4).
  BRA1: {
    factor: 0.09,
    baseRates: { over15: 0.72, over25: 0.46, over35: 0.25, over45: 0.11 },
    btts: { factor: 0.27, baseYes: 0.47 },
  },
  // CSL: full-sample slopes o15 0.33 · o25 0.61 · o35 0.77 · o45 0.66; forward ΔBrier OU -0.0023 (4/4).
  CSL: {
    factor: 0.59,
    baseRates: { over15: 0.83, over25: 0.63, over35: 0.45, over45: 0.21 },
    btts: { factor: 0.17, baseYes: 0.63 },
    ouHt: { factor05: 0.4, base05: 0.83, factor15: 1, base15: 0.43 },
  },
  // CZE1: full-sample slopes o15 0.22 · o25 0.35 · o35 0.42 · o45 0.27; forward ΔBrier OU +0.0007 (2/4).
  CZE1: {
    factor: 1,
    baseRates: { over15: 0.74, over25: 0.51, over35: 0.27, over45: 0.13 },
    btts: { factor: 0.4, baseYes: 0.47 },
    ouHt: { factor05: 0.21, base05: 0.71, factor15: 0.28, base15: 0.36 },
  },
  // D2: full-sample slopes o15 0.25 · o25 0.10 · o35 0.36 · o45 0.11; forward ΔBrier OU +0.0007 (2/4).
  D2: {
    factor: 1,
    baseRates: { over15: 0.8, over25: 0.58, over35: 0.34, over45: 0.17 },
    btts: { factor: 0.15, baseYes: 0.6 },
    ouHt: { factor05: 1, base05: 0.72, factor15: 0.14, base15: 0.38 },
  },
  // EL1: full-sample slopes o15 0.22 · o25 0.31 · o35 0.57 · o45 0.50; forward ΔBrier OU -0.0021 (4/4).
  EL1: {
    factor: 0.4,
    baseRates: { over15: 0.72, over25: 0.5, over35: 0.26, over45: 0.12 },
    btts: { factor: 0.51, baseYes: 0.52 },
  },
  // EL2: full-sample slopes o15 0.19 · o25 0.26 · o35 0.33 · o45 0.17; forward ΔBrier OU -0.0037 (4/4).
  EL2: {
    factor: 0.24,
    baseRates: { over15: 0.72, over25: 0.47, over35: 0.25, over45: 0.11 },
    btts: { factor: 0.38, baseYes: 0.51 },
    ouHt: { factor05: 1, base05: 0.66, factor15: 0.33, base15: 0.32 },
  },
  // EST1: full-sample slopes o15 0.05 · o25 0.62 · o35 0.55 · o45 0.38; forward ΔBrier OU -0.0012 (2/4).
  EST1: {
    factor: 1,
    baseRates: { over15: 0.81, over25: 0.62, over35: 0.37, over45: 0.16 },
    ouHt: { factor05: 1, base05: 0.79, factor15: 0.7, base15: 0.44 },
  },
  // F2: full-sample slopes o15 -0.13 · o25 -0.06 · o35 0.17 · o45 0.34; forward ΔBrier OU -0.0032 (4/4).
  F2: {
    factor: 0.08,
    baseRates: { over15: 0.69, over25: 0.48, over35: 0.27, over45: 0.12 },
    btts: { factor: 0.32, baseYes: 0.5 },
    ouHt: { factor05: 0.0, base05: 0.67, factor15: 0.0, base15: 0.31 },
  },
  // FIN1: full-sample slopes o15 0.11 · o25 0.13 · o35 0.47 · o45 0.40; forward ΔBrier OU -0.0009 (2/4).
  FIN1: {
    factor: 1,
    baseRates: { over15: 0.83, over25: 0.66, over35: 0.45, over45: 0.26 },
    btts: { factor: 0.3, baseYes: 0.64 },
    ouHt: { factor05: 1, base05: 0.72, factor15: 0.05, base15: 0.4 },
  },
  // I2: full-sample slopes o15 -0.25 · o25 -0.02 · o35 0.24 · o45 0.42; forward ΔBrier OU +0.0008 (3/4).
  I2: {
    factor: 1,
    baseRates: { over15: 0.73, over25: 0.47, over35: 0.25, over45: 0.09 },
    btts: { factor: 0.0, baseYes: 0.53 },
  },
  // ISL1: full-sample slopes o15 0.53 · o25 0.39 · o35 0.23 · o45 0.23; forward ΔBrier OU +0.0037 (1/4).
  ISL1: {
    factor: 1,
    baseRates: { over15: 0.86, over25: 0.65, over35: 0.46, over45: 0.3 },
    ouHt: { factor05: 1, base05: 0.78, factor15: 0.42, base15: 0.46 },
  },
  // J1: full-sample slopes o15 0.36 · o25 0.35 · o35 0.62 · o45 0.49; forward ΔBrier OU -0.0047 (4/4).
  J1: {
    factor: 0.46,
    baseRates: { over15: 0.7, over25: 0.46, over35: 0.22, over45: 0.1 },
    btts: { factor: 0.17, baseYes: 0.49 },
    ouHt: { factor05: 1, base05: 0.62, factor15: 0.32, base15: 0.3 },
  },
  // KOR1: full-sample slopes o15 -0.21 · o25 0.15 · o35 -0.06 · o45 0.18; forward ΔBrier OU -0.0058 (4/4).
  KOR1: {
    factor: 0.02,
    baseRates: { over15: 0.71, over25: 0.49, over35: 0.28, over45: 0.13 },
    btts: { factor: 0.0, baseYes: 0.55 },
    ouHt: { factor05: 0.0, base05: 0.63, factor15: 0.0, base15: 0.27 },
  },
  // L1: full-sample slopes o15 0.08 · o25 0.43 · o35 0.25 · o45 0.18; forward ΔBrier OU -0.0012 (3/4).
  L1: {
    factor: 0.23,
    baseRates: { over15: 0.79, over25: 0.55, over35: 0.35, over45: 0.17 },
  },
  // LAT1: full-sample slopes o15 0.00 · o25 0.23 · o35 0.62 · o45 0.97; forward ΔBrier OU -0.0067 (4/4).
  LAT1: {
    factor: 0.46,
    baseRates: { over15: 0.78, over25: 0.57, over35: 0.36, over45: 0.23 },
    btts: { factor: 0.32, baseYes: 0.52 },
    ouHt: { factor05: 0.0, base05: 0.74, factor15: 0.72, base15: 0.38 },
  },
  // MLS: full-sample slopes o15 0.24 · o25 0.34 · o35 0.41 · o45 0.20; forward ΔBrier OU -0.0077 (4/4).
  MLS: {
    factor: 0.3,
    baseRates: { over15: 0.8, over25: 0.6, over35: 0.36, over45: 0.2 },
    btts: { factor: 0.28, baseYes: 0.61 },
    ouHt: { factor05: 0.3, base05: 0.78, factor15: 0.22, base15: 0.41 },
  },
  // MX1: full-sample slopes o15 0.12 · o25 0.29 · o35 0.07 · o45 0.04; forward ΔBrier OU -0.0017 (4/4).
  MX1: {
    factor: 0.13,
    baseRates: { over15: 0.78, over25: 0.56, over35: 0.31, over45: 0.17 },
    btts: { factor: 0.13, baseYes: 0.57 },
    ouHt: { factor05: 0.0, base05: 0.72, factor15: 1, base15: 0.39 },
  },
  // NOR1: full-sample slopes o15 0.13 · o25 0.33 · o35 0.31 · o45 0.30; forward ΔBrier OU -0.0047 (4/4).
  NOR1: {
    factor: 0.27,
    baseRates: { over15: 0.83, over25: 0.62, over35: 0.41, over45: 0.23 },
    btts: { factor: 0.43, baseYes: 0.58 },
    ouHt: { factor05: 0.03, base05: 0.77, factor15: 0.0, base15: 0.42 },
  },
  // NOR2: full-sample slopes o15 0.22 · o25 0.22 · o35 0.28 · o45 0.26; forward ΔBrier OU -0.0067 (4/4).
  NOR2: {
    factor: 0.24,
    baseRates: { over15: 0.86, over25: 0.65, over35: 0.42, over45: 0.23 },
    btts: { factor: 0.32, baseYes: 0.63 },
    ouHt: { factor05: 0.27, base05: 0.76, factor15: 0.37, base15: 0.41 },
  },
  // POL1: full-sample slopes o15 0.21 · o25 0.29 · o35 0.43 · o45 0.45; forward ΔBrier OU -0.0012 (4/4).
  POL1: {
    factor: 0.35,
    baseRates: { over15: 0.76, over25: 0.51, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.09, baseYes: 0.57 },
  },
  // SP2: full-sample slopes o15 0.38 · o25 0.17 · o35 0.02 · o45 0.45; forward ΔBrier OU +0.0023 (1/4).
  SP2: {
    factor: 1,
    baseRates: { over15: 0.7, over25: 0.49, over35: 0.28, over45: 0.13 },
    ouHt: { factor05: 0.02, base05: 0.66, factor15: 1, base15: 0.31 },
  },
  // SRB1: full-sample slopes o15 0.29 · o25 0.40 · o35 0.27 · o45 0.39; forward ΔBrier OU -0.0019 (2/4).
  SRB1: {
    factor: 1,
    baseRates: { over15: 0.74, over25: 0.53, over35: 0.32, over45: 0.16 },
    btts: { factor: 0.05, baseYes: 0.54 },
    ouHt: { factor05: 0.57, base05: 0.71, factor15: 1, base15: 0.36 },
  },
  // SUI1: full-sample slopes o15 -0.01 · o25 0.16 · o35 0.26 · o45 0.07; forward ΔBrier OU +0.0005 (2/4).
  SUI1: {
    factor: 1,
    baseRates: { over15: 0.83, over25: 0.61, over35: 0.37, over45: 0.2 },
    btts: { factor: 0.0, baseYes: 0.63 },
    ouHt: { factor05: 0.09, base05: 0.75, factor15: 1, base15: 0.41 },
  },
  // SUI2: full-sample slopes o15 -0.00 · o25 0.05 · o35 0.14 · o45 0.00; forward ΔBrier OU -0.0020 (4/4).
  SUI2: {
    factor: 0.05,
    baseRates: { over15: 0.8, over25: 0.61, over35: 0.36, over45: 0.16 },
    btts: { factor: 0.0, baseYes: 0.59 },
    ouHt: { factor05: 0.08, base05: 0.76, factor15: 1, base15: 0.44 },
  },
  // SVN1: full-sample slopes o15 -0.06 · o25 0.27 · o35 0.32 · o45 0.05; forward ΔBrier OU -0.0038 (3/4).
  SVN1: {
    factor: 0.14,
    baseRates: { over15: 0.8, over25: 0.57, over35: 0.32, over45: 0.18 },
    btts: { factor: 0.51, baseYes: 0.55 },
    ouHt: { factor05: 0.0, base05: 0.8, factor15: 0.0, base15: 0.33 },
  },
  // SWE1: full-sample slopes o15 0.20 · o25 0.16 · o35 0.11 · o45 0.18; forward ΔBrier OU -0.0054 (4/4).
  SWE1: {
    factor: 0.16,
    baseRates: { over15: 0.79, over25: 0.52, over35: 0.3, over45: 0.17 },
  },
  // SWE2: full-sample slopes o15 0.13 · o25 0.08 · o35 0.14 · o45 -0.07; forward ΔBrier OU -0.0124 (4/4).
  SWE2: {
    factor: 0.07,
    baseRates: { over15: 0.79, over25: 0.55, over35: 0.34, over45: 0.16 },
    btts: { factor: 0.07, baseYes: 0.55 },
    ouHt: { factor05: 0.0, base05: 0.74, factor15: 0.0, base15: 0.37 },
  },
  // TUR1: full-sample slopes o15 -0.04 · o25 0.29 · o35 0.40 · o45 0.52; forward ΔBrier OU -0.0004 (2/4).
  TUR1: {
    factor: 1,
    baseRates: { over15: 0.77, over25: 0.54, over35: 0.32, over45: 0.17 },
    btts: { factor: 0.0, baseYes: 0.56 },
  },
  // TUR2: full-sample slopes o15 0.30 · o25 0.47 · o35 0.57 · o45 0.85; forward ΔBrier OU -0.0016 (4/4).
  TUR2: {
    factor: 0.55,
    baseRates: { over15: 0.75, over25: 0.51, over35: 0.31, over45: 0.16 },
    btts: { factor: 0.22, baseYes: 0.47 },
    ouHt: { factor05: 0.07, base05: 0.71, factor15: 1, base15: 0.37 },
  },
  // UCL: full-sample slopes o15 -0.02 · o25 0.03 · o35 0.23 · o45 0.16; forward ΔBrier OU -0.0013 (4/4).
  UCL: {
    factor: 0.1,
    baseRates: { over15: 0.78, over25: 0.6, over35: 0.39, over45: 0.24 },
  },
  // UECL: full-sample slopes o15 -0.02 · o25 -0.03 · o35 0.17 · o45 0.15; forward ΔBrier OU -0.0094 (4/4).
  UECL: {
    factor: 0.07,
    baseRates: { over15: 0.75, over25: 0.54, over35: 0.31, over45: 0.16 },
    btts: { factor: 0.09, baseYes: 0.48 },
    ouHt: { factor05: 0.0, base05: 0.68, factor15: 0.0, base15: 0.33 },
  },
  // UEL: full-sample slopes o15 0.00 · o25 0.02 · o35 0.38 · o45 0.38; forward ΔBrier OU -0.0036 (4/4).
  UEL: {
    factor: 0.2,
    baseRates: { over15: 0.75, over25: 0.54, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.04, baseYes: 0.51 },
    ouHt: { factor05: 1, base05: 0.71, factor15: 0.14, base15: 0.37 },
  },
  // WC: full-sample slopes o15 0.18 · o25 0.36 · o35 0.54 · o45 0.31; forward ΔBrier OU +0.0058 (2/4).
  WC: {
    factor: 1,
    baseRates: { over15: 0.77, over25: 0.52, over35: 0.31, over45: 0.19 },
    btts: { factor: 0.29, baseYes: 0.52 },
  },
  // WCQAF: full-sample slopes o15 0.26 · o25 0.35 · o35 0.37 · o45 0.53; forward ΔBrier OU -0.0035 (3/4).
  WCQAF: {
    factor: 0.38,
    baseRates: { over15: 0.68, over25: 0.43, over35: 0.24, over45: 0.12 },
    btts: { factor: 0.0, baseYes: 0.39 },
    ouHt: { factor05: 1, base05: 0.68, factor15: 0.46, base15: 0.3 },
  },
  // WCQAS: full-sample slopes o15 0.39 · o25 0.61 · o35 0.70 · o45 0.78; forward ΔBrier OU -0.0022 (4/4).
  WCQAS: {
    factor: 0.62,
    baseRates: { over15: 0.71, over25: 0.52, over35: 0.33, over45: 0.19 },
    btts: { factor: 0.34, baseYes: 0.36 },
  },
  // WCQCA: full-sample slopes o15 0.30 · o25 0.37 · o35 0.52 · o45 0.64; forward ΔBrier OU -0.0048 (4/4).
  WCQCA: {
    factor: 0.46,
    baseRates: { over15: 0.76, over25: 0.53, over35: 0.32, over45: 0.2 },
    btts: { factor: 0.23, baseYes: 0.36 },
    ouHt: { factor05: 1, base05: 0.71, factor15: 0.6, base15: 0.39 },
  },
  // WCQE: full-sample slopes o15 0.13 · o25 0.17 · o35 0.53 · o45 0.68; forward ΔBrier OU -0.0030 (3/4).
  WCQE: {
    factor: 0.38,
    baseRates: { over15: 0.81, over25: 0.56, over35: 0.4, over45: 0.21 },
    btts: { factor: 0.12, baseYes: 0.42 },
    ouHt: { factor05: 0.11, base05: 0.74, factor15: 0.33, base15: 0.37 },
  },
  // WCQSA: full-sample slopes o15 0.79 · o25 0.64 · o35 0.39 · o45 0.57; forward ΔBrier OU -0.0012 (4/4).
  WCQSA: {
    factor: 0.6,
    baseRates: { over15: 0.62, over25: 0.41, over35: 0.21, over45: 0.09 },
    btts: { factor: 0.0, baseYes: 0.34 },
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
