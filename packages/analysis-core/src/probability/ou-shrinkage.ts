import Decimal from "decimal.js";
import type {
  DerivedMarketsProba,
  TeamTotalProba,
  ThreeWayProba,
} from "./markets";

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
  // Optional: a league can ship WITHOUT full-time O/U coverage (e.g. only a
  // teamTotalHome/teamTotalAway block below) when only that market's audit
  // has been run for it — see the 2026-08-15 TEAM_TOTAL calibration pass,
  // which added leagues with no prior full O/U measurement.
  factor?: number;
  // Empirical over-rates on the recent-seasons blend. Required together
  // with `factor` — either both are present (full O/U shrinkage active for
  // this league) or neither is.
  baseRates?: {
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
  // TEAM_TOTAL_HOME/AWAY derive from the same per-side Poisson marginal as
  // full-time O/U (computeTeamTotalProba) — same data-poor-league
  // overdispersion risk, but never had a shrinkage path (audit 2026-08-13:
  // confirmed in DB — TEAM_TOTAL_AWAY UNDER_1_5 measured ROI +0.75% despite
  // a displayed EV of +22.4%, the same overconfidence pattern O/U shrinkage
  // exists to correct). Sparse per-line, same shape as ouHt: only lines with
  // a measured factor/base are shrunk, `home`/`away` are independent blocks
  // since each side's Poisson marginal is calibrated separately.
  teamTotalHome?: TeamTotalShrinkageBlock;
  teamTotalAway?: TeamTotalShrinkageBlock;
};

// Sparse per-line shrinkage for one side's TEAM_TOTAL — mirrors `ouHt`
// (factor/base pair per line) generalized to every line the strategy layer
// actually evaluates (getTeamTotalLineConfigs: 0.5 through 4.5).
export type TeamTotalShrinkageBlock = Partial<
  Record<"05" | "15" | "25" | "35" | "45", { factor: number; base: number }>
>;

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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: { "05": { factor: 0.8, base: 0.87 } },
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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.56, base: 0.82 },
      "15": { factor: 0.51, base: 0.5 },
    },
  },
  // EL1: full-sample slopes o15 0.22 · o25 0.31 · o35 0.57 · o45 0.50; forward ΔBrier OU -0.0021 (4/4).
  EL1: {
    factor: 0.4,
    baseRates: { over15: 0.72, over25: 0.5, over35: 0.26, over45: 0.12 },
    btts: { factor: 0.51, baseYes: 0.52 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.62, base: 0.41 },
      "25": { factor: 0.51, base: 0.19 },
    },
    teamTotalAway: {
      "05": { factor: 0.7, base: 0.7 },
      "15": { factor: 0.65, base: 0.32 },
      "25": { factor: 0.67, base: 0.11 },
      "35": { factor: 0.27, base: 0.03 },
    },
  },
  // EL2: full-sample slopes o15 0.19 · o25 0.26 · o35 0.33 · o45 0.17; forward ΔBrier OU -0.0037 (4/4).
  EL2: {
    factor: 0.24,
    baseRates: { over15: 0.72, over25: 0.47, over35: 0.25, over45: 0.11 },
    btts: { factor: 0.38, baseYes: 0.51 },
    ouHt: { factor05: 1, base05: 0.66, factor15: 0.33, base15: 0.32 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: { "25": { factor: 0.46, base: 0.12 } },
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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.34, base: 0.67 },
      "15": { factor: 0.39, base: 0.32 },
      "25": { factor: 0.11, base: 0.11 },
    },
  },
  // FIN1: full-sample slopes o15 0.11 · o25 0.13 · o35 0.47 · o45 0.40; forward ΔBrier OU -0.0009 (2/4).
  FIN1: {
    factor: 1,
    baseRates: { over15: 0.83, over25: 0.66, over35: 0.45, over45: 0.26 },
    btts: { factor: 0.3, baseYes: 0.64 },
    ouHt: { factor05: 1, base05: 0.72, factor15: 0.05, base15: 0.4 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.66, base: 0.76 },
      "25": { factor: 0.85, base: 0.25 },
      "35": { factor: 0.6, base: 0.05 },
    },
    teamTotalAway: {
      "05": { factor: 0.52, base: 0.79 },
      "15": { factor: 0.58, base: 0.46 },
      "25": { factor: 0.61, base: 0.19 },
    },
  },
  // I2: full-sample slopes o15 -0.25 · o25 -0.02 · o35 0.24 · o45 0.42; forward ΔBrier OU +0.0008 (3/4).
  I2: {
    factor: 1,
    baseRates: { over15: 0.73, over25: 0.47, over35: 0.25, over45: 0.09 },
    btts: { factor: 0.0, baseYes: 0.53 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "15": { factor: 0.58, base: 0.31 },
      "25": { factor: 0.34, base: 0.09 },
      "35": { factor: 0.16, base: 0.01 },
    },
  },
  // ISL1: full-sample slopes o15 0.53 · o25 0.39 · o35 0.23 · o45 0.23; forward ΔBrier OU +0.0037 (1/4).
  ISL1: {
    factor: 1,
    baseRates: { over15: 0.86, over25: 0.65, over35: 0.46, over45: 0.3 },
    ouHt: { factor05: 1, base05: 0.78, factor15: 0.42, base15: 0.46 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.79, base: 0.85 },
      "15": { factor: 0.78, base: 0.58 },
    },
    teamTotalAway: {
      "05": { factor: 0.47, base: 0.77 },
      "15": { factor: 0.63, base: 0.4 },
      "25": { factor: 0.6, base: 0.16 },
      "35": { factor: 0.35, base: 0.08 },
      "45": { factor: 0.52, base: 0.04 },
    },
  },
  // J1: full-sample slopes o15 0.36 · o25 0.35 · o35 0.62 · o45 0.49; forward ΔBrier OU -0.0047 (4/4).
  J1: {
    factor: 0.46,
    baseRates: { over15: 0.7, over25: 0.46, over35: 0.22, over45: 0.1 },
    btts: { factor: 0.17, baseYes: 0.49 },
    ouHt: { factor05: 1, base05: 0.62, factor15: 0.32, base15: 0.3 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.41, base: 0.75 },
      "15": { factor: 0.64, base: 0.39 },
      "25": { factor: 0.59, base: 0.15 },
      "35": { factor: 0.31, base: 0.05 },
      "45": { factor: 0.17, base: 0.02 },
    },
    teamTotalAway: {
      "05": { factor: 0.67, base: 0.67 },
      "15": { factor: 0.34, base: 0.31 },
      "25": { factor: 0.36, base: 0.12 },
    },
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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.64, base: 0.46 },
      "25": { factor: 0.48, base: 0.22 },
    },
    teamTotalAway: { "15": { factor: 0.62, base: 0.37 } },
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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.58, base: 0.51 },
      "25": { factor: 0.82, base: 0.25 },
    },
    teamTotalAway: { "05": { factor: 0.18, base: 0.74 } },
  },
  // MX1: full-sample slopes o15 0.12 · o25 0.29 · o35 0.07 · o45 0.04; forward ΔBrier OU -0.0017 (4/4).
  MX1: {
    factor: 0.13,
    baseRates: { over15: 0.78, over25: 0.56, over35: 0.31, over45: 0.17 },
    btts: { factor: 0.13, baseYes: 0.57 },
    ouHt: { factor05: 0.0, base05: 0.72, factor15: 1, base15: 0.39 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: { "25": { factor: 0.62, base: 0.11 } },
  },
  // NOR1: full-sample slopes o15 0.13 · o25 0.33 · o35 0.31 · o45 0.30; forward ΔBrier OU -0.0047 (4/4).
  NOR1: {
    factor: 0.27,
    baseRates: { over15: 0.83, over25: 0.62, over35: 0.41, over45: 0.23 },
    btts: { factor: 0.43, baseYes: 0.58 },
    ouHt: { factor05: 0.03, base05: 0.77, factor15: 0.0, base15: 0.42 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: { "15": { factor: 0.55, base: 0.5 } },
  },
  // NOR2: full-sample slopes o15 0.22 · o25 0.22 · o35 0.28 · o45 0.26; forward ΔBrier OU -0.0067 (4/4).
  NOR2: {
    factor: 0.24,
    baseRates: { over15: 0.86, over25: 0.65, over35: 0.42, over45: 0.23 },
    btts: { factor: 0.32, baseYes: 0.63 },
    ouHt: { factor05: 0.27, base05: 0.76, factor15: 0.37, base15: 0.41 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.55, base: 0.84 },
      "15": { factor: 0.6, base: 0.53 },
    },
  },
  // POL1: full-sample slopes o15 0.21 · o25 0.29 · o35 0.43 · o45 0.45; forward ΔBrier OU -0.0012 (4/4).
  POL1: {
    factor: 0.35,
    baseRates: { over15: 0.76, over25: 0.51, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.09, baseYes: 0.57 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.25, base: 0.8 },
      "15": { factor: 0.35, base: 0.45 },
      "25": { factor: 0.58, base: 0.2 },
    },
    teamTotalAway: {
      "15": { factor: 0.36, base: 0.34 },
      "25": { factor: 0.24, base: 0.11 },
      "35": { factor: 0.3, base: 0.03 },
    },
  },
  // SP2: full-sample slopes o15 0.38 · o25 0.17 · o35 0.02 · o45 0.45; forward ΔBrier OU +0.0023 (1/4).
  SP2: {
    factor: 1,
    baseRates: { over15: 0.7, over25: 0.49, over35: 0.28, over45: 0.13 },
    ouHt: { factor05: 0.02, base05: 0.66, factor15: 1, base15: 0.31 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "15": { factor: 0.35, base: 0.3 },
      "25": { factor: 0.33, base: 0.1 },
    },
  },
  // SRB1: full-sample slopes o15 0.29 · o25 0.40 · o35 0.27 · o45 0.39; forward ΔBrier OU -0.0019 (2/4).
  SRB1: {
    factor: 1,
    baseRates: { over15: 0.74, over25: 0.53, over35: 0.32, over45: 0.16 },
    btts: { factor: 0.05, baseYes: 0.54 },
    ouHt: { factor05: 0.57, base05: 0.71, factor15: 1, base15: 0.36 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: { "15": { factor: 0.8, base: 0.42 } },
    teamTotalAway: {
      "05": { factor: 0.64, base: 0.68 },
      "15": { factor: 0.63, base: 0.35 },
      "25": { factor: 0.71, base: 0.15 },
    },
  },
  // SUI1: full-sample slopes o15 -0.01 · o25 0.16 · o35 0.26 · o45 0.07; forward ΔBrier OU +0.0005 (2/4).
  SUI1: {
    factor: 1,
    baseRates: { over15: 0.83, over25: 0.61, over35: 0.37, over45: 0.2 },
    btts: { factor: 0.0, baseYes: 0.63 },
    ouHt: { factor05: 0.09, base05: 0.75, factor15: 1, base15: 0.41 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: { "25": { factor: 0.48, base: 0.25 } },
    teamTotalAway: { "35": { factor: 0.41, base: 0.06 } },
  },
  // SUI2: full-sample slopes o15 -0.00 · o25 0.05 · o35 0.14 · o45 0.00; forward ΔBrier OU -0.0020 (4/4).
  SUI2: {
    factor: 0.05,
    baseRates: { over15: 0.8, over25: 0.61, over35: 0.36, over45: 0.16 },
    btts: { factor: 0.0, baseYes: 0.59 },
    ouHt: { factor05: 0.08, base05: 0.76, factor15: 1, base15: 0.44 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: { "35": { factor: 0.11, base: 0.06 } },
    teamTotalAway: {
      "05": { factor: 0.47, base: 0.75 },
      "15": { factor: 0.54, base: 0.44 },
    },
  },
  // SVN1: full-sample slopes o15 -0.06 · o25 0.27 · o35 0.32 · o45 0.05; forward ΔBrier OU -0.0038 (3/4).
  SVN1: {
    factor: 0.14,
    baseRates: { over15: 0.8, over25: 0.57, over35: 0.32, over45: 0.18 },
    btts: { factor: 0.51, baseYes: 0.55 },
    ouHt: { factor05: 0.0, base05: 0.8, factor15: 0.0, base15: 0.33 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.79, base: 0.71 },
      "15": { factor: 0.75, base: 0.35 },
    },
  },
  // SWE1: full-sample slopes o15 0.20 · o25 0.16 · o35 0.11 · o45 0.18; forward ΔBrier OU -0.0054 (4/4).
  SWE1: {
    factor: 0.16,
    baseRates: { over15: 0.79, over25: 0.52, over35: 0.3, over45: 0.17 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.48, base: 0.72 },
      "15": { factor: 0.41, base: 0.4 },
      "25": { factor: 0.45, base: 0.17 },
      "35": { factor: 0.27, base: 0.04 },
      "45": { factor: 0.12, base: 0.01 },
    },
  },
  // SWE2: full-sample slopes o15 0.13 · o25 0.08 · o35 0.14 · o45 -0.07; forward ΔBrier OU -0.0124 (4/4).
  SWE2: {
    factor: 0.07,
    baseRates: { over15: 0.79, over25: 0.55, over35: 0.34, over45: 0.16 },
    btts: { factor: 0.07, baseYes: 0.55 },
    ouHt: { factor05: 0.0, base05: 0.74, factor15: 0.0, base15: 0.37 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.36, base: 0.77 },
      "15": { factor: 0.56, base: 0.49 },
      "25": { factor: 0.35, base: 0.25 },
      "35": { factor: 0.5, base: 0.11 },
      "45": { factor: 0.27, base: 0.03 },
    },
    teamTotalAway: {
      "05": { factor: 0.58, base: 0.71 },
      "15": { factor: 0.4, base: 0.38 },
      "25": { factor: 0.25, base: 0.12 },
      "35": { factor: 0.25, base: 0.04 },
    },
  },
  // TUR1: full-sample slopes o15 -0.04 · o25 0.29 · o35 0.40 · o45 0.52; forward ΔBrier OU -0.0004 (2/4).
  TUR1: {
    factor: 1,
    baseRates: { over15: 0.77, over25: 0.54, over35: 0.32, over45: 0.17 },
    btts: { factor: 0.0, baseYes: 0.56 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: { "05": { factor: 0.67, base: 0.8 } },
    teamTotalAway: { "05": { factor: 0.56, base: 0.69 } },
  },
  // TUR2: full-sample slopes o15 0.30 · o25 0.47 · o35 0.57 · o45 0.85; forward ΔBrier OU -0.0016 (4/4).
  TUR2: {
    factor: 0.55,
    baseRates: { over15: 0.75, over25: 0.51, over35: 0.31, over45: 0.16 },
    btts: { factor: 0.22, baseYes: 0.47 },
    ouHt: { factor05: 0.07, base05: 0.71, factor15: 1, base15: 0.37 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.73, base: 0.76 },
      "15": { factor: 0.79, base: 0.43 },
    },
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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.58, base: 0.66 },
      "15": { factor: 0.4, base: 0.36 },
      "25": { factor: 0.29, base: 0.14 },
      "35": { factor: 0.24, base: 0.06 },
    },
  },
  // UEL: full-sample slopes o15 0.00 · o25 0.02 · o35 0.38 · o45 0.38; forward ΔBrier OU -0.0036 (4/4).
  UEL: {
    factor: 0.2,
    baseRates: { over15: 0.75, over25: 0.54, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.04, baseYes: 0.51 },
    ouHt: { factor05: 1, base05: 0.71, factor15: 0.14, base15: 0.37 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.02, base: 0.69 },
      "15": { factor: 0.1, base: 0.34 },
      "35": { factor: 0.08, base: 0.03 },
    },
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
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.89, base: 0.41 },
      "25": { factor: 1.0, base: 0.26 },
      "35": { factor: 0.6, base: 0.11 },
    },
    teamTotalAway: { "15": { factor: 0.66, base: 0.15 } },
  },
  // ARG1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  ARG1: {
    teamTotalHome: {
      "15": { factor: 0.31, base: 0.3 },
      "25": { factor: 0.55, base: 0.1 },
    },
    teamTotalAway: {
      "05": { factor: 0.41, base: 0.59 },
      "15": { factor: 0.37, base: 0.23 },
      "25": { factor: 0.22, base: 0.06 },
    },
  },
  // ARG2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  ARG2: {
    teamTotalHome: {
      "05": { factor: 0.56, base: 0.7 },
      "15": { factor: 0.53, base: 0.32 },
      "25": { factor: 0.37, base: 0.09 },
    },
    teamTotalAway: {
      "05": { factor: 0.39, base: 0.51 },
      "15": { factor: 0.39, base: 0.16 },
      "25": { factor: 0.31, base: 0.04 },
    },
  },
  // AUS1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  AUS1: {
    teamTotalHome: {
      "05": { factor: 0.64, base: 0.78 },
      "15": { factor: 0.45, base: 0.45 },
      "25": { factor: 0.71, base: 0.21 },
      "35": { factor: 0.25, base: 0.09 },
    },
    teamTotalAway: {
      "05": { factor: 0.41, base: 0.79 },
      "15": { factor: 0.61, base: 0.46 },
    },
  },
  // AUT1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  AUT1: {
    teamTotalHome: {
      "05": { factor: 0.24, base: 0.79 },
      "15": { factor: 0.29, base: 0.45 },
      "25": { factor: 0.17, base: 0.16 },
    },
    teamTotalAway: {
      "05": { factor: 0.57, base: 0.69 },
      "15": { factor: 0.53, base: 0.34 },
      "25": { factor: 0.55, base: 0.14 },
    },
  },
  // BEL1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  BEL1: {
    teamTotalHome: { "05": { factor: 0.59, base: 0.77 } },
    teamTotalAway: {
      "05": { factor: 0.65, base: 0.68 },
      "15": { factor: 0.59, base: 0.36 },
      "25": { factor: 0.55, base: 0.12 },
    },
  },
  // BRA2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  BRA2: {
    teamTotalHome: {
      "05": { factor: 0.43, base: 0.78 },
      "25": { factor: 0.49, base: 0.11 },
    },
    teamTotalAway: {
      "15": { factor: 0.22, base: 0.24 },
      "25": { factor: 0.12, base: 0.07 },
    },
  },
  // CH: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CH: {
    teamTotalHome: { "05": { factor: 0.57, base: 0.78 } },
  },
  // CHI1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CHI1: {
    teamTotalHome: {
      "05": { factor: 0.47, base: 0.79 },
      "15": { factor: 0.72, base: 0.49 },
    },
    teamTotalAway: { "05": { factor: 0.3, base: 0.69 } },
  },
  // CHI2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CHI2: {
    teamTotalHome: {
      "05": { factor: 0.32, base: 0.76 },
      "15": { factor: 0.61, base: 0.43 },
      "25": { factor: 0.7, base: 0.21 },
    },
    teamTotalAway: {
      "05": { factor: 0.41, base: 0.7 },
      "15": { factor: 0.55, base: 0.35 },
    },
  },
  // CHN2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CHN2: {
    teamTotalHome: {
      "05": { factor: 0.54, base: 0.78 },
      "15": { factor: 0.8, base: 0.46 },
    },
  },
  // D3: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  D3: {
    teamTotalHome: {
      "05": { factor: 0.61, base: 0.81 },
      "15": { factor: 0.48, base: 0.52 },
    },
    teamTotalAway: {
      "05": { factor: 0.32, base: 0.75 },
      "15": { factor: 0.49, base: 0.36 },
      "35": { factor: 0.27, base: 0.07 },
    },
  },
  // DEN1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  DEN1: {
    teamTotalHome: { "05": { factor: 0.6, base: 0.82 } },
    teamTotalAway: {
      "05": { factor: 0.47, base: 0.75 },
      "15": { factor: 0.74, base: 0.43 },
    },
  },
  // FIN2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  FIN2: {
    teamTotalAway: { "05": { factor: 0.5, base: 0.8 } },
  },
  // GRE1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  GRE1: {
    teamTotalAway: { "25": { factor: 0.75, base: 0.1 } },
  },
  // IRL1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  IRL1: {
    teamTotalAway: {
      "05": { factor: 0.27, base: 0.67 },
      "15": { factor: 0.56, base: 0.33 },
      "25": { factor: 0.44, base: 0.1 },
      "35": { factor: 0.3, base: 0.03 },
    },
  },
  // KOR2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  KOR2: {
    teamTotalHome: {
      "05": { factor: 0.68, base: 0.71 },
      "15": { factor: 0.44, base: 0.39 },
      "25": { factor: 0.28, base: 0.16 },
      "35": { factor: 0.33, base: 0.06 },
    },
    teamTotalAway: {
      "05": { factor: 0.66, base: 0.72 },
      "15": { factor: 0.76, base: 0.36 },
    },
  },
  // KSA1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  KSA1: {
    teamTotalHome: { "05": { factor: 0.67, base: 0.8 } },
  },
  // LL: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  LL: {
    teamTotalAway: {
      "15": { factor: 0.76, base: 0.32 },
      "25": { factor: 0.52, base: 0.1 },
    },
  },
  // POL2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  POL2: {
    teamTotalHome: {
      "15": { factor: 0.74, base: 0.46 },
      "25": { factor: 0.61, base: 0.18 },
    },
    teamTotalAway: {
      "05": { factor: 0.68, base: 0.76 },
      "15": { factor: 0.58, base: 0.38 },
      "25": { factor: 0.57, base: 0.14 },
      "35": { factor: 0.51, base: 0.04 },
    },
  },
  // RUS1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  RUS1: {
    teamTotalHome: { "25": { factor: 0.75, base: 0.18 } },
    teamTotalAway: {
      "15": { factor: 0.7, base: 0.29 },
      "25": { factor: 0.64, base: 0.11 },
      "35": { factor: 0.31, base: 0.03 },
    },
  },
  // SCO1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  SCO1: {
    teamTotalHome: {
      "05": { factor: 0.76, base: 0.81 },
      "15": { factor: 0.84, base: 0.49 },
    },
  },
  // USA2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  USA2: {
    teamTotalHome: {
      "05": { factor: 0.28, base: 0.75 },
      "15": { factor: 0.41, base: 0.44 },
      "25": { factor: 0.7, base: 0.19 },
    },
    teamTotalAway: {
      "05": { factor: 0.51, base: 0.68 },
      "15": { factor: 0.43, base: 0.31 },
      "25": { factor: 0.35, base: 0.12 },
    },
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

  // Full-time O/U shrinkage requires both factor and baseRates — a league
  // can ship with only a teamTotalHome/teamTotalAway (or btts/ouHt) block
  // and no full O/U coverage at all (2026-08-15 TEAM_TOTAL calibration pass
  // added several such leagues). `result` is always a fresh shallow copy
  // (never the original `probabilities` reference) so the btts/ouHt/
  // teamTotal mutations below never leak into the caller's input object.
  const result: T = { ...probabilities };
  if (config.factor !== undefined && config.baseRates !== undefined) {
    const { factor, baseRates } = config;
    const over15 = shrinkWith(probabilities.over15, baseRates.over15, factor);
    const over25 = shrinkWith(probabilities.over25, baseRates.over25, factor);
    const over35 = shrinkWith(probabilities.over35, baseRates.over35, factor);
    const over45 = shrinkWith(probabilities.over45, baseRates.over45, factor);

    result.over15 = over15;
    result.under15 = new Decimal(1).minus(over15);
    result.over25 = over25;
    result.under25 = new Decimal(1).minus(over25);
    result.over35 = over35;
    result.under35 = new Decimal(1).minus(over35);
    result.over45 = over45;
    result.under45 = new Decimal(1).minus(over45);
  }

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

  if (config.teamTotalHome) {
    result.teamTotalHome = shrinkTeamTotal(
      probabilities.teamTotalHome,
      config.teamTotalHome,
    );
  }

  if (config.teamTotalAway) {
    result.teamTotalAway = shrinkTeamTotal(
      probabilities.teamTotalAway,
      config.teamTotalAway,
    );
  }

  return result;
}

const TEAM_TOTAL_LINE_KEYS: Record<
  keyof TeamTotalShrinkageBlock,
  { over: keyof TeamTotalProba; under: keyof TeamTotalProba }
> = {
  "05": { over: "OVER_0_5", under: "UNDER_0_5" },
  "15": { over: "OVER_1_5", under: "UNDER_1_5" },
  "25": { over: "OVER_2_5", under: "UNDER_2_5" },
  "35": { over: "OVER_3_5", under: "UNDER_3_5" },
  "45": { over: "OVER_4_5", under: "UNDER_4_5" },
};

function shrinkTeamTotal(
  proba: TeamTotalProba,
  block: TeamTotalShrinkageBlock,
): TeamTotalProba {
  const result: TeamTotalProba = { ...proba };
  for (const lineKey of Object.keys(TEAM_TOTAL_LINE_KEYS) as Array<
    keyof TeamTotalShrinkageBlock
  >) {
    const lineConfig = block[lineKey];
    if (!lineConfig) continue;
    const { over: overKey, under: underKey } = TEAM_TOTAL_LINE_KEYS[lineKey];
    const over = proba[overKey];
    if (over === undefined) continue;
    const shrunk = shrinkWith(over, lineConfig.base, lineConfig.factor);
    result[overKey] = shrunk;
    if (proba[underKey] !== undefined) {
      result[underKey] = new Decimal(1).minus(shrunk);
    }
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
