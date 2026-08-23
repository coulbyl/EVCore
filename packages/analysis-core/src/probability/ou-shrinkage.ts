import Decimal from "decimal.js";
import type {
  DerivedMarketsProba,
  ResultBttsProba,
  ResultTotalGoalsProba,
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
  // RESULT_TOTAL_GOALS (e.g. "HOME_OVER_2_5") is a genuine joint price — the
  // UNDER pick is a direct joint-distribution sum (P(side wins AND under
  // line)), and OVER = oneXTwo[side] − UNDER (see computeResultTotalGoalsProba
  // and rebalanceThreeWayProbabilities' comment). Unlike full O/U/TEAM_TOTAL,
  // the complement is NOT `1 − under` — it's bounded by that side's own win
  // probability, not by 1. Shrinking has to preserve that: shrink the UNDER
  // joint probability toward its own measured base rate, then recompute OVER
  // against the (already 1X2-rebalanced) side mass, exactly like
  // rebalanceThreeWayProbabilities already does when home/draw/away move.
  resultTotalGoals?: ResultTotalGoalsShrinkageBlock;
  // CLEAN_SHEET_HOME/AWAY and TO_WIN_EITHER_HALF (2026-08-15, walk-forward
  // validated: db:backtest:channel-league-whitelist showed 0 confirmed
  // league for either channel while carrying real settled volume — 104/264
  // (competition×side) blocks shipped, see
  // packages/db/reports/backtest-clean-sheet-win-either-half-shrinkage-calibration-2026-08-15.txt).
  // Each is a single probability per side (no line dimension, unlike O/U/
  // TEAM_TOTAL) and — unlike bttsYes/bttsNo or over/under — home and away
  // are NOT complementary (winEitherHalf can be true for both sides at
  // once, per poisson.ts), so each shrinks independently with no paired
  // 1-minus update.
  cleanSheetHome?: { factor: number; base: number };
  cleanSheetAway?: { factor: number; base: number };
  winEitherHalfHome?: { factor: number; base: number };
  winEitherHalfAway?: { factor: number; base: number };
  // WIN_TO_NIL_HOME/AWAY (2026-08-19, walk-forward validated: audit du
  // replay complet montre ce marché structurellement perdant une fois
  // filtré sur l'edge ≥0.10 de VALUE — WIN_TO_NIL_AWAY: 5/5 ligues à n≥5
  // en ROI négatif, -75.6% moyen, le pire marché du pool VALUE. Jamais eu
  // de shrinkage avant. Même forme que cleanSheet* : probabilité
  // indépendante par côté (winToNilHome = cleanSheetHome × P(home marque
  // ≥1), poisson.ts — composée, donc plus bruitée que cleanSheet seul),
  // home/away pas complémentaires. Voir db:backtest:win-to-nil-shrinkage-
  // calibration.
  winToNilHome?: { factor: number; base: number };
  winToNilAway?: { factor: number; base: number };
  // DRAW_NO_BET (2026-08-19, walk-forward validated: 13/22 ligues à n≥5 en
  // ROI négatif une fois filtré sur l'edge ≥0.10 de VALUE, jamais eu de
  // shrinkage avant). dnbHome = oneXTwo.home / (oneXTwo.home +
  // oneXTwo.away) (poisson.ts) — probabilité CONDITIONNELLE au match
  // non-nul (le marché se règle push sur nul, jamais calibré sur les
  // matchs nuls). dnbHome + dnbAway = 1 (paire complémentaire, comme
  // bttsYes/bttsNo) : un seul champ, dnbAway = 1 − dnbHome. Voir
  // db:backtest:draw-no-bet-shrinkage-calibration.
  dnbHome?: { factor: number; base: number };
  // RESULT_BTTS (2026-08-19, walk-forward validated: 17/26 ligues à n≥5 en
  // ROI négatif une fois filtré sur l'edge ≥0.10 de VALUE, -13.2% moyen,
  // jamais eu de shrinkage avant — contrairement à RESULT_TOTAL_GOALS, sa
  // contrepartie côté buts). Même structure que resultTotalGoals (prix
  // joint réel, computeResultBttsProba) mais sans dimension ligne : on
  // shrink la probabilité jointe YES par côté vers sa base mesurée, NO se
  // déduit de la masse du côté (oneXTwo[side] − YES), jamais régressé
  // séparément. Voir db:backtest:result-btts-shrinkage-calibration.
  resultBtts?: Partial<
    Record<"HOME" | "DRAW" | "AWAY", { factor: number; base: number }>
  >;
};

// Sparse per-line shrinkage for one side's TEAM_TOTAL — mirrors `ouHt`
// (factor/base pair per line) generalized to every line the strategy layer
// actually evaluates (getTeamTotalLineConfigs: 0.5 through 4.5).
export type TeamTotalShrinkageBlock = Partial<
  Record<"05" | "15" | "25" | "35" | "45", { factor: number; base: number }>
>;

// Sparse per-(side, line) shrinkage for RESULT_TOTAL_GOALS. `base` here is
// the measured base rate of the UNDER joint probability (P(side wins AND
// under line)), not a conditional/normalized rate — same units as the raw
// Poisson UNDER value being shrunk.
export type ResultTotalGoalsShrinkageBlock = Partial<
  Record<
    "HOME" | "DRAW" | "AWAY",
    Partial<Record<"15" | "25" | "35" | "45", { factor: number; base: number }>>
  >
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
    btts: { factor: 0.11, baseYes: 0.62 },
    ouHt: { factor05: 0.4, base05: 0.83, factor15: 1, base15: 0.43 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.71, base: 0.82 },
      "15": { factor: 0.89, base: 0.53 },
    },
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
    btts: { factor: 0.19, baseYes: 0.61 },
    ouHt: { factor05: 1, base05: 0.72, factor15: 0.14, base15: 0.38 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.56, base: 0.82 },
      "15": { factor: 0.51, base: 0.5 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      AWAY: {
        "25": { factor: 0.52, base: 0.08 },
        "45": { factor: 0.62, base: 0.226 },
      },
    },
  },
  // EL1: full-sample slopes o15 0.22 · o25 0.31 · o35 0.57 · o45 0.50; forward ΔBrier OU -0.0021 (4/4).
  EL1: {
    factor: 0.4,
    baseRates: { over15: 0.72, over25: 0.5, over35: 0.26, over45: 0.12 },
    btts: { factor: 0.44, baseYes: 0.52 },
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
    btts: { factor: 0.39, baseYes: 0.51 },
    ouHt: { factor05: 1, base05: 0.66, factor15: 0.33, base15: 0.32 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "25": { factor: 0.46, base: 0.12 },
    },
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
    btts: { factor: 0.22, baseYes: 0.5 },
    ouHt: { factor05: 0.0, base05: 0.67, factor15: 0.0, base15: 0.31 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.34, base: 0.67 },
      "15": { factor: 0.39, base: 0.32 },
      "25": { factor: 0.11, base: 0.11 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: {
        "15": { factor: 0.0, base: 0.09 },
        "45": { factor: 0.0, base: 0.258 },
      },
    },
  },
  // FIN1: full-sample slopes o15 0.11 · o25 0.13 · o35 0.47 · o45 0.40; forward ΔBrier OU -0.0009 (2/4).
  FIN1: {
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): factor re-fit à 0.92 (ΔBrier test -0.0024, n train=417/test=44).
    factor: 0.92,
    baseRates: { over15: 0.82, over25: 0.63, over35: 0.38, over45: 0.18 },
    btts: { factor: 0.41, baseYes: 0.62 },
    ouHt: { factor05: 1, base05: 0.72, factor15: 0.05, base15: 0.4 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.53, base: 0.78 },
      "15": { factor: 0.85, base: 0.51 },
      "25": { factor: 0.87, base: 0.25 },
      "35": { factor: 0.6, base: 0.05 },
    },
    teamTotalAway: {
      "05": { factor: 0.38, base: 0.75 },
      "15": { factor: 0.48, base: 0.42 },
      "25": { factor: 0.58, base: 0.19 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "45": { factor: 0.82, base: 0.292 } },
      DRAW: { "15": { factor: 0.08, base: 0.059 } },
      AWAY: { "15": { factor: 0.37, base: 0.065 } },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: { "45": { factor: 0.5, base: 0.307 } },
      AWAY: {
        "25": { factor: 0.13, base: 0.107 },
        "45": { factor: 0.78, base: 0.231 },
      },
    },
  },
  // ISL1: full-sample slopes o15 0.53 · o25 0.39 · o35 0.23 · o45 0.23; forward ΔBrier OU +0.0037 (1/4).
  ISL1: {
    factor: 1,
    baseRates: { over15: 0.86, over25: 0.65, over35: 0.46, over45: 0.3 },
    ouHt: { factor05: 1, base05: 0.78, factor15: 0.42, base15: 0.46 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.77, base: 0.85 },
      "15": { factor: 0.6, base: 0.58 },
    },
    teamTotalAway: {
      "05": { factor: 0.23, base: 0.78 },
      "15": { factor: 0.66, base: 0.41 },
      "25": { factor: 0.66, base: 0.18 },
      "35": { factor: 0.45, base: 0.09 },
      "45": { factor: 0.47, base: 0.04 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.0, base: 0.063 },
        "35": { factor: 0.61, base: 0.27 },
        "45": { factor: 0.72, base: 0.308 },
      },
      DRAW: {
        "25": { factor: 0.37, base: 0.164 },
        "35": { factor: 0.37, base: 0.164 },
      },
      AWAY: {
        "25": { factor: 0.73, base: 0.075 },
        "35": { factor: 0.66, base: 0.138 },
        "45": { factor: 0.74, base: 0.157 },
      },
    },
    btts: { factor: 0.02, baseYes: 0.67 },
  },
  // J1: full-sample slopes o15 0.36 · o25 0.35 · o35 0.62 · o45 0.49; forward ΔBrier OU -0.0047 (4/4).
  J1: {
    factor: 0.46,
    baseRates: { over15: 0.7, over25: 0.46, over35: 0.22, over45: 0.1 },
    btts: { factor: 0.4, baseYes: 0.51 },
    ouHt: { factor05: 1, base05: 0.62, factor15: 0.32, base15: 0.3 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.41, base: 0.75 },
      "15": { factor: 0.59, base: 0.4 },
      "25": { factor: 0.59, base: 0.15 },
      "35": { factor: 0.31, base: 0.05 },
      "45": { factor: 0.17, base: 0.02 },
    },
    teamTotalAway: {
      "05": { factor: 0.67, base: 0.67 },
      "15": { factor: 0.36, base: 0.33 },
      "25": { factor: 0.36, base: 0.12 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: {
        "25": { factor: 0.26, base: 0.202 },
        "35": { factor: 0.26, base: 0.202 },
        "45": { factor: 0.0, base: 0.248 },
      },
      AWAY: {
        "25": { factor: 0.37, base: 0.128 },
        "35": { factor: 0.47, base: 0.235 },
        "45": { factor: 0.41, base: 0.265 },
      },
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
    teamTotalAway: {
      "15": { factor: 0.62, base: 0.37 },
    },
  },
  // LAT1: full-sample slopes o15 0.00 · o25 0.23 · o35 0.62 · o45 0.97; forward ΔBrier OU -0.0067 (4/4).
  LAT1: {
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): factor re-fit à 0.89 (ΔBrier test -0.0023, n train=464/test=30).
    factor: 0.89,
    baseRates: { over15: 0.79, over25: 0.59, over35: 0.37, over45: 0.23 },
    btts: { factor: 0.15, baseYes: 0.51 },
    ouHt: { factor05: 0.0, base05: 0.74, factor15: 0.72, base15: 0.38 },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "15": { factor: 0.54, base: 0.081 } },
      DRAW: {
        "25": { factor: 0.67, base: 0.151 },
        "35": { factor: 0.67, base: 0.151 },
      },
      AWAY: { "15": { factor: 0.38, base: 0.108 } },
    },
  },
  // MLS: full-sample slopes o15 0.24 · o25 0.34 · o35 0.41 · o45 0.20; forward ΔBrier OU -0.0077 (4/4).
  MLS: {
    factor: 0.3,
    baseRates: { over15: 0.8, over25: 0.6, over35: 0.36, over45: 0.2 },
    btts: { factor: 0.34, baseYes: 0.62 },
    ouHt: { factor05: 0.3, base05: 0.78, factor15: 0.22, base15: 0.41 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.57, base: 0.51 },
    },
    teamTotalAway: { "05": { factor: 0.18, base: 0.74 } },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.51, base: 0.074 },
        "25": { factor: 0.53, base: 0.133 },
        "45": { factor: 0.63, base: 0.351 },
      },
      AWAY: {
        "15": { factor: 0.5, base: 0.066 },
        "35": { factor: 0.47, base: 0.177 },
      },
    },
  },
  // MX1: full-sample slopes o15 0.12 · o25 0.29 · o35 0.07 · o45 0.04; forward ΔBrier OU -0.0017 (4/4).
  MX1: {
    factor: 0.13,
    baseRates: { over15: 0.78, over25: 0.56, over35: 0.31, over45: 0.17 },
    btts: { factor: 0.13, baseYes: 0.57 },
    ouHt: { factor05: 0.0, base05: 0.72, factor15: 1, base15: 0.39 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "25": { factor: 0.62, base: 0.11 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: { AWAY: { "45": { factor: 0.76, base: 0.208 } } },
  },
  // NOR1: full-sample slopes o15 0.13 · o25 0.33 · o35 0.31 · o45 0.30; forward ΔBrier OU -0.0047 (4/4).
  NOR1: {
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente): factor re-fit à 0.92 (ΔBrier test -0.0018, n train=591/test=46).
    factor: 0.92,
    baseRates: { over15: 0.83, over25: 0.64, over35: 0.4, over45: 0.23 },
    btts: { factor: 0.43, baseYes: 0.58 },
    ouHt: { factor05: 0.03, base05: 0.77, factor15: 0.0, base15: 0.42 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.55, base: 0.51 },
      "35": { factor: 0.8, base: 0.14 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: {
        "15": { factor: 0.0, base: 0.034 },
        "25": { factor: 0.0, base: 0.13 },
        "35": { factor: 0.0, base: 0.13 },
        "45": { factor: 0.0, base: 0.176 },
      },
    },
  },
  // NOR2: full-sample slopes o15 0.22 · o25 0.22 · o35 0.28 · o45 0.26; forward ΔBrier OU -0.0067 (4/4).
  NOR2: {
    factor: 0.24,
    baseRates: { over15: 0.86, over25: 0.65, over35: 0.42, over45: 0.23 },
    btts: { factor: 0.32, baseYes: 0.63 },
    ouHt: { factor05: 0.27, base05: 0.76, factor15: 0.37, base15: 0.41 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.56, base: 0.84 },
      "15": { factor: 0.62, base: 0.54 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      AWAY: {
        "35": { factor: 0.74, base: 0.163 },
        "45": { factor: 0.74, base: 0.203 },
      },
    },
    teamTotalAway: {
      "05": { factor: 0.74, base: 0.77 },
    },
  },
  // POL1: full-sample slopes o15 0.21 · o25 0.29 · o35 0.43 · o45 0.45; forward ΔBrier OU -0.0012 (4/4).
  POL1: {
    factor: 0.35,
    baseRates: { over15: 0.76, over25: 0.51, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.23, baseYes: 0.57 },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "35": { factor: 0.26, base: 0.297 },
        "45": { factor: 0.28, base: 0.366 },
      },
      DRAW: { "45": { factor: 0.0, base: 0.25 } },
      AWAY: {
        "25": { factor: 0.16, base: 0.118 },
        "35": { factor: 0.17, base: 0.209 },
        "45": { factor: 0.19, base: 0.244 },
      },
    },
  },
  // SP2: full-sample slopes o15 0.38 · o25 0.17 · o35 0.02 · o45 0.45; forward ΔBrier OU +0.0023 (1/4).
  SP2: {
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente): factor re-fit à 0.91 (ΔBrier test -0.0014, n train=826/test=412).
    factor: 0.91,
    baseRates: { over15: 0.71, over25: 0.49, over35: 0.28, over45: 0.13 },
    ouHt: { factor05: 0.02, base05: 0.66, factor15: 1, base15: 0.31 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "15": { factor: 0.35, base: 0.3 },
      "25": { factor: 0.33, base: 0.1 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: {
        "25": { factor: 0.0, base: 0.206 },
        "35": { factor: 0.0, base: 0.206 },
      },
    },
  },
  // SRB1: full-sample slopes o15 0.29 · o25 0.40 · o35 0.27 · o45 0.39; forward ΔBrier OU -0.0019 (2/4).
  SRB1: {
    factor: 1,
    baseRates: { over15: 0.74, over25: 0.53, over35: 0.32, over45: 0.16 },
    btts: { factor: 0.16, baseYes: 0.54 },
    ouHt: { factor05: 0.57, base05: 0.71, factor15: 1, base15: 0.36 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.8, base: 0.42 },
    },
    teamTotalAway: {
      "05": { factor: 0.64, base: 0.68 },
      "15": { factor: 0.63, base: 0.35 },
      "25": { factor: 0.71, base: 0.15 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "35": { factor: 0.74, base: 0.271 },
        "45": { factor: 0.8, base: 0.329 },
      },
      AWAY: { "45": { factor: 0.79, base: 0.267 } },
    },
  },
  // SUI1: full-sample slopes o15 -0.01 · o25 0.16 · o35 0.26 · o45 0.07; forward ΔBrier OU +0.0005 (2/4).
  SUI1: {
    factor: 1,
    baseRates: { over15: 0.83, over25: 0.61, over35: 0.37, over45: 0.2 },
    btts: { factor: 0.04, baseYes: 0.63 },
    ouHt: { factor05: 0.09, base05: 0.75, factor15: 1, base15: 0.41 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "25": { factor: 0.48, base: 0.25 },
    },
    teamTotalAway: {
      "35": { factor: 0.41, base: 0.06 },
    },
  },
  // SUI2: full-sample slopes o15 -0.00 · o25 0.05 · o35 0.14 · o45 0.00; forward ΔBrier OU -0.0020 (4/4).
  SUI2: {
    factor: 0.05,
    baseRates: { over15: 0.8, over25: 0.61, over35: 0.36, over45: 0.16 },
    btts: { factor: 0.0, baseYes: 0.6 },
    ouHt: { factor05: 0.08, base05: 0.76, factor15: 1, base15: 0.44 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "35": { factor: 0.11, base: 0.06 },
    },
    teamTotalAway: {
      "05": { factor: 0.47, base: 0.75 },
      "15": { factor: 0.54, base: 0.44 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      AWAY: {
        "15": { factor: 0.1, base: 0.049 },
        "25": { factor: 0.02, base: 0.11 },
      },
    },
  },
  // SVN1: full-sample slopes o15 -0.06 · o25 0.27 · o35 0.32 · o45 0.05; forward ΔBrier OU -0.0038 (3/4).
  SVN1: {
    factor: 0.14,
    baseRates: { over15: 0.8, over25: 0.57, over35: 0.32, over45: 0.18 },
    btts: { factor: 0.22, baseYes: 0.55 },
    ouHt: { factor05: 0.0, base05: 0.8, factor15: 0.0, base15: 0.33 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.79, base: 0.71 },
      "15": { factor: 0.75, base: 0.35 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.0, base: 0.08 },
        "25": { factor: 0.28, base: 0.15 },
      },
    },
  },
  // SWE1: full-sample slopes o15 0.20 · o25 0.16 · o35 0.11 · o45 0.18; forward ΔBrier OU -0.0054 (4/4).
  SWE1: {
    factor: 0.16,
    baseRates: { over15: 0.79, over25: 0.52, over35: 0.3, over45: 0.17 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.46, base: 0.72 },
      "15": { factor: 0.53, base: 0.37 },
      "25": { factor: 0.46, base: 0.17 },
      "35": { factor: 0.32, base: 0.05 },
      "45": { factor: 0.12, base: 0.01 },
    },
    teamTotalHome: {
      "15": { factor: 0.7, base: 0.43 },
    },
    btts: { factor: 0.07, baseYes: 0.53 },
  },
  // SWE2: full-sample slopes o15 0.13 · o25 0.08 · o35 0.14 · o45 -0.07; forward ΔBrier OU -0.0124 (4/4).
  SWE2: {
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): factor re-fit à 0.84 (ΔBrier test -0.0061, n train=600/test=56).
    factor: 0.84,
    baseRates: { over15: 0.77, over25: 0.55, over35: 0.34, over45: 0.16 },
    btts: { factor: 0.0, baseYes: 0.57 },
    ouHt: { factor05: 0.0, base05: 0.74, factor15: 0.0, base15: 0.37 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.28, base: 0.77 },
      "15": { factor: 0.57, base: 0.49 },
      "25": { factor: 0.31, base: 0.23 },
      "35": { factor: 0.49, base: 0.11 },
      "45": { factor: 0.28, base: 0.03 },
    },
    teamTotalAway: {
      "05": { factor: 0.55, base: 0.71 },
      "15": { factor: 0.27, base: 0.38 },
      "25": { factor: 0.25, base: 0.12 },
      "35": { factor: 0.01, base: 0.03 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.0, base: 0.063 },
        "25": { factor: 0.57, base: 0.119 },
      },
      DRAW: {
        "15": { factor: 0.2, base: 0.087 },
        "25": { factor: 0.0, base: 0.182 },
        "35": { factor: 0.0, base: 0.182 },
        "45": { factor: 0.0, base: 0.253 },
      },
      AWAY: { "15": { factor: 0.26, base: 0.071 } },
    },
  },
  // TUR1: full-sample slopes o15 -0.04 · o25 0.29 · o35 0.40 · o45 0.52; forward ΔBrier OU -0.0004 (2/4).
  TUR1: {
    factor: 1,
    baseRates: { over15: 0.77, over25: 0.54, over35: 0.32, over45: 0.17 },
    btts: { factor: 0.0, baseYes: 0.56 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.67, base: 0.8 },
    },
    teamTotalAway: {
      "05": { factor: 0.56, base: 0.69 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.49, base: 0.161 },
        "35": { factor: 0.74, base: 0.301 },
        "45": { factor: 0.78, base: 0.368 },
      },
      AWAY: {
        "15": { factor: 0.55, base: 0.053 },
        "25": { factor: 0.77, base: 0.092 },
        "35": { factor: 0.88, base: 0.179 },
      },
    },
  },
  // TUR2: full-sample slopes o15 0.30 · o25 0.47 · o35 0.57 · o45 0.85; forward ΔBrier OU -0.0016 (4/4).
  TUR2: {
    factor: 0.55,
    baseRates: { over15: 0.75, over25: 0.51, over35: 0.31, over45: 0.16 },
    btts: { factor: 0.23, baseYes: 0.46 },
    ouHt: { factor05: 0.07, base05: 0.71, factor15: 1, base15: 0.37 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "05": { factor: 0.73, base: 0.76 },
      "15": { factor: 0.79, base: 0.43 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.58, base: 0.191 },
        "35": { factor: 0.64, base: 0.299 },
        "45": { factor: 0.78, base: 0.38 },
      },
      AWAY: {
        "25": { factor: 0.58, base: 0.115 },
        "35": { factor: 0.66, base: 0.197 },
        "45": { factor: 0.69, base: 0.235 },
      },
    },
  },
  // UCL: full-sample slopes o15 -0.02 · o25 0.03 · o35 0.23 · o45 0.16; forward ΔBrier OU -0.0013 (4/4).
  UCL: {
    factor: 0.1,
    baseRates: { over15: 0.78, over25: 0.6, over35: 0.39, over45: 0.24 },
  },
  // UECL: full-sample slopes o15 -0.02 · o25 -0.03 · o35 0.17 · o45 0.15; forward ΔBrier OU -0.0094 (4/4).
  UECL: {
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente): factor re-fit à 0.95 (ΔBrier test -0.0011, n train=155/test=92).
    factor: 0.95,
    baseRates: { over15: 0.74, over25: 0.53, over35: 0.29, over45: 0.11 },
    btts: { factor: 0.34, baseYes: 0.48 },
    ouHt: { factor05: 0.0, base05: 0.68, factor15: 0.0, base15: 0.33 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.58, base: 0.66 },
      "15": { factor: 0.4, base: 0.36 },
      "25": { factor: 0.29, base: 0.14 },
      "35": { factor: 0.24, base: 0.06 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.0, base: 0.112 },
        "25": { factor: 0.0, base: 0.197 },
        "45": { factor: 0.77, base: 0.394 },
      },
      DRAW: {
        "25": { factor: 0.25, base: 0.144 },
        "35": { factor: 0.25, base: 0.144 },
        "45": { factor: 0.41, base: 0.191 },
      },
      AWAY: { "25": { factor: 0.55, base: 0.128 } },
    },
  },
  // UEL: full-sample slopes o15 0.00 · o25 0.02 · o35 0.38 · o45 0.38; forward ΔBrier OU -0.0036 (4/4).
  UEL: {
    factor: 0.2,
    baseRates: { over15: 0.75, over25: 0.54, over35: 0.3, over45: 0.14 },
    btts: { factor: 0.38, baseYes: 0.53 },
    ouHt: { factor05: 1, base05: 0.71, factor15: 0.14, base15: 0.37 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalAway: {
      "05": { factor: 0.02, base: 0.69 },
      "15": { factor: 0.1, base: 0.34 },
      "35": { factor: 0.08, base: 0.03 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.0, base: 0.123 },
        "25": { factor: 0.0, base: 0.198 },
      },
      DRAW: {
        "15": { factor: 0.28, base: 0.028 },
        "25": { factor: 1.0, base: 0.123 },
        "35": { factor: 1.0, base: 0.123 },
        "45": { factor: 1.0, base: 0.17 },
      },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "35": { factor: 0.73, base: 0.221 } },
      DRAW: { "15": { factor: 0.0, base: 0.039 } },
    },
  },
  // WCQSA: full-sample slopes o15 0.79 · o25 0.64 · o35 0.39 · o45 0.57; forward ΔBrier OU -0.0012 (4/4).
  WCQSA: {
    factor: 0.6,
    baseRates: { over15: 0.62, over25: 0.41, over35: 0.21, over45: 0.09 },
    btts: { factor: 0.38, baseYes: 0.33 },
    // TEAM_TOTAL_HOME/AWAY (2026-08-15, walk-forward validated): see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
    teamTotalHome: {
      "15": { factor: 0.89, base: 0.41 },
      "25": { factor: 1.0, base: 0.26 },
      "35": { factor: 0.6, base: 0.11 },
    },
    teamTotalAway: {
      "15": { factor: 0.66, base: 0.15 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: { AWAY: { "35": { factor: 0.73, base: 0.155 } } },
  },
  // ARG1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  ARG1: {
    teamTotalHome: {
      "15": { factor: 0.31, base: 0.3 },
      "25": { factor: 0.45, base: 0.11 },
    },
    teamTotalAway: {
      "05": { factor: 0.39, base: 0.59 },
      "15": { factor: 0.36, base: 0.21 },
      "25": { factor: 0.14, base: 0.06 },
      "35": { factor: 0.23, base: 0.01 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.33, base: 0.228 },
        "35": { factor: 0.12, base: 0.333 },
        "45": { factor: 0.25, base: 0.369 },
      },
      AWAY: { "15": { factor: 0.0, base: 0.102 } },
    },
    btts: { factor: 0.23, baseYes: 0.41 },
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): factor re-fit à 0.93 (ΔBrier test -0.0012, n train=1049/test=254).
    factor: 0.93,
    baseRates: { over15: 0.6, over25: 0.32, over35: 0.14, over45: 0.06 },
  },
  // ARG2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  ARG2: {
    teamTotalHome: {
      "05": { factor: 0.55, base: 0.7 },
      "15": { factor: 0.51, base: 0.33 },
      "25": { factor: 0.31, base: 0.09 },
    },
    teamTotalAway: {
      "05": { factor: 0.34, base: 0.5 },
      "15": { factor: 0.39, base: 0.16 },
      "25": { factor: 0.2, base: 0.04 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.43, base: 0.175 },
        "25": { factor: 0.28, base: 0.281 },
        "35": { factor: 0.41, base: 0.407 },
        "45": { factor: 0.43, base: 0.443 },
      },
      DRAW: {
        "25": { factor: 0.56, base: 0.298 },
        "35": { factor: 0.56, base: 0.298 },
      },
      AWAY: {
        "25": { factor: 0.58, base: 0.126 },
        "35": { factor: 0.56, base: 0.186 },
        "45": { factor: 0.49, base: 0.203 },
      },
    },
    btts: { factor: 0.44, baseYes: 0.36 },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      AWAY: {
        "35": { factor: 0.55, base: 0.229 },
        "45": { factor: 0.45, base: 0.298 },
      },
    },
    btts: { factor: 0.79, baseYes: 0.62 },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "45": { factor: 0.68, base: 0.372 } },
      DRAW: {
        "25": { factor: 0.0, base: 0.201 },
        "35": { factor: 0.0, base: 0.201 },
      },
      AWAY: {
        "25": { factor: 0.41, base: 0.104 },
        "35": { factor: 0.57, base: 0.207 },
        "45": { factor: 0.58, base: 0.25 },
      },
    },
    btts: { factor: 0.0, baseYes: 0.55 },
  },
  // BEL1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  BEL1: {
    teamTotalHome: {
      "05": { factor: 0.59, base: 0.77 },
    },
    teamTotalAway: {
      "05": { factor: 0.65, base: 0.68 },
      "15": { factor: 0.59, base: 0.36 },
      "25": { factor: 0.55, base: 0.12 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      AWAY: {
        "25": { factor: 0.45, base: 0.116 },
        "35": { factor: 0.64, base: 0.223 },
      },
    },
    btts: { factor: 0.55, baseYes: 0.53 },
  },
  // BRA2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  BRA2: {
    teamTotalHome: {
      "05": { factor: 0.42, base: 0.78 },
      "25": { factor: 0.49, base: 0.1 },
    },
    teamTotalAway: {
      "15": { factor: 0.21, base: 0.24 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.15, base: 0.146 },
        "35": { factor: 0.21, base: 0.389 },
        "45": { factor: 0.29, base: 0.422 },
      },
      AWAY: {
        "25": { factor: 0.45, base: 0.12 },
        "35": { factor: 0.53, base: 0.197 },
        "45": { factor: 0.52, base: 0.223 },
      },
    },
  },
  // CH: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CH: {
    teamTotalHome: {
      "05": { factor: 0.57, base: 0.78 },
    },
  },
  // CHI1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CHI1: {
    teamTotalHome: {
      "05": { factor: 0.47, base: 0.8 },
      "15": { factor: 0.72, base: 0.49 },
    },
    teamTotalAway: {
      "05": { factor: 0.28, base: 0.7 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "15": { factor: 0.0, base: 0.132 },
        "25": { factor: 0.46, base: 0.202 },
        "35": { factor: 0.61, base: 0.344 },
        "45": { factor: 0.71, base: 0.404 },
      },
      DRAW: {
        "25": { factor: 0.28, base: 0.123 },
        "35": { factor: 0.28, base: 0.123 },
      },
      AWAY: {
        "35": { factor: 0.78, base: 0.232 },
        "45": { factor: 0.69, base: 0.248 },
      },
    },
  },
  // CHI2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CHI2: {
    teamTotalHome: {
      "05": { factor: 0.31, base: 0.77 },
      "15": { factor: 0.6, base: 0.43 },
      "25": { factor: 0.65, base: 0.19 },
    },
    teamTotalAway: {
      "05": { factor: 0.54, base: 0.71 },
      "15": { factor: 0.55, base: 0.34 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "35": { factor: 0.65, base: 0.261 },
        "45": { factor: 0.56, base: 0.307 },
      },
      AWAY: {
        "15": { factor: 0.0, base: 0.114 },
        "25": { factor: 0.0, base: 0.148 },
        "35": { factor: 0.05, base: 0.239 },
        "45": { factor: 0.1, base: 0.267 },
      },
    },
    btts: { factor: 0.46, baseYes: 0.53 },
  },
  // CHN2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  CHN2: {
    teamTotalHome: {
      "05": { factor: 0.55, base: 0.77 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: { "15": { factor: 0.04, base: 0.069 } },
      AWAY: { "25": { factor: 0.84, base: 0.119 } },
    },
    btts: { factor: 0.34, baseYes: 0.55 },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "45": { factor: 0.49, base: 0.367 } },
      AWAY: {
        "35": { factor: 0.81, base: 0.167 },
        "45": { factor: 0.67, base: 0.214 },
      },
    },
    btts: { factor: 0.52, baseYes: 0.62 },
  },
  // DEN1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  DEN1: {
    teamTotalHome: {
      "05": { factor: 0.6, base: 0.82 },
    },
    teamTotalAway: {
      "05": { factor: 0.47, base: 0.75 },
      "15": { factor: 0.74, base: 0.43 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.43, base: 0.144 },
        "35": { factor: 0.52, base: 0.267 },
        "45": { factor: 0.64, base: 0.322 },
      },
      AWAY: { "25": { factor: 0.35, base: 0.077 } },
    },
    btts: { factor: 0.44, baseYes: 0.62 },
  },
  // FIN2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  FIN2: {
    teamTotalAway: {
      "05": { factor: 0.48, base: 0.8 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "25": { factor: 0.67, base: 0.119 } },
      DRAW: {
        "15": { factor: 0.25, base: 0.04 },
        "25": { factor: 0.21, base: 0.159 },
        "35": { factor: 0.21, base: 0.159 },
      },
    },
  },
  // GRE1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  GRE1: {
    teamTotalAway: {
      "25": { factor: 0.75, base: 0.1 },
    },
    btts: { factor: 0.36, baseYes: 0.48 },
  },
  // IRL1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  IRL1: {
    teamTotalAway: {
      "05": { factor: 0.27, base: 0.67 },
      "15": { factor: 0.56, base: 0.33 },
      "25": { factor: 0.44, base: 0.1 },
      "35": { factor: 0.0, base: 0.02 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: { "45": { factor: 0.53, base: 0.35 } },
      AWAY: {
        "35": { factor: 0.66, base: 0.202 },
        "45": { factor: 0.69, base: 0.228 },
      },
    },
  },
  // KOR2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  KOR2: {
    teamTotalHome: {
      "05": { factor: 0.69, base: 0.71 },
      "15": { factor: 0.45, base: 0.39 },
      "25": { factor: 0.24, base: 0.15 },
      "35": { factor: 0.09, base: 0.05 },
    },
    teamTotalAway: {
      "05": { factor: 0.63, base: 0.73 },
      "15": { factor: 0.75, base: 0.37 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.53, base: 0.128 },
        "35": { factor: 0.64, base: 0.226 },
        "45": { factor: 0.62, base: 0.256 },
      },
      DRAW: {
        "25": { factor: 0.24, base: 0.218 },
        "35": { factor: 0.24, base: 0.218 },
        "45": { factor: 0.56, base: 0.308 },
      },
    },
    btts: { factor: 0.66, baseYes: 0.53 },
  },
  // KSA1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  KSA1: {
    teamTotalHome: {
      "05": { factor: 0.67, base: 0.8 },
    },
    btts: { factor: 0.28, baseYes: 0.57 },
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
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.5, base: 0.116 },
        "45": { factor: 0.73, base: 0.326 },
      },
      DRAW: { "45": { factor: 0.06, base: 0.254 } },
    },
  },
  // RUS1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  RUS1: {
    teamTotalHome: {
      "25": { factor: 0.75, base: 0.18 },
    },
    teamTotalAway: {
      "15": { factor: 0.7, base: 0.29 },
      "25": { factor: 0.64, base: 0.11 },
      "35": { factor: 0.31, base: 0.03 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      AWAY: {
        "35": { factor: 0.8, base: 0.205 },
        "45": { factor: 0.73, base: 0.233 },
      },
    },
  },
  // SCO1: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  SCO1: {
    teamTotalHome: {
      "05": { factor: 0.76, base: 0.81 },
      "15": { factor: 0.84, base: 0.49 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      DRAW: {
        "15": { factor: 0.0, base: 0.051 },
        "25": { factor: 0.13, base: 0.141 },
        "35": { factor: 0.13, base: 0.141 },
      },
      AWAY: {
        "25": { factor: 0.52, base: 0.096 },
        "45": { factor: 0.71, base: 0.242 },
      },
    },
  },
  // USA2: no full-time O/U measurement yet — TEAM_TOTAL_HOME/AWAY only,
  // walk-forward validated 2026-08-15, see packages/db/reports/backtest-team-total-shrinkage-calibration-2026-08-15.txt.
  USA2: {
    teamTotalHome: {
      "05": { factor: 0.28, base: 0.75 },
      "15": { factor: 0.4, base: 0.45 },
      "25": { factor: 0.69, base: 0.19 },
    },
    teamTotalAway: {
      "05": { factor: 0.5, base: 0.67 },
      "15": { factor: 0.28, base: 0.3 },
      "25": { factor: 0.35, base: 0.12 },
    },
    // RESULT_TOTAL_GOALS (2026-08-15, walk-forward validated): see packages/db/reports/backtest-result-total-goals-shrinkage-calibration-2026-08-15.txt.
    resultTotalGoals: {
      HOME: {
        "25": { factor: 0.23, base: 0.175 },
        "35": { factor: 0.35, base: 0.295 },
        "45": { factor: 0.39, base: 0.346 },
      },
      AWAY: {
        "25": { factor: 0.35, base: 0.141 },
        "35": { factor: 0.42, base: 0.209 },
        "45": { factor: 0.43, base: 0.229 },
      },
    },
    btts: { factor: 0.2, baseYes: 0.52 },
    // Walk-forward 2026-08-19 (db:backtest:goals-shrinkage-calibration, train=toutes saisons sauf la + récente, test=la + récente, fenêtre récente): factor re-fit à 0.86 (ΔBrier test -0.0014, n train=1026/test=170).
    factor: 0.86,
    baseRates: { over15: 0.71, over25: 0.48, over35: 0.28, over45: 0.16 },
  },
};

// CLEAN_SHEET_HOME/AWAY + TO_WIN_EITHER_HALF shrinkage, generated by
// db:backtest:clean-sheet-win-either-half-shrinkage-calibration (2026-08-15),
// see packages/db/reports/backtest-clean-sheet-win-either-half-shrinkage-calibration-2026-08-15.txt.
// Kept as a separate overlay (merged below) rather than spliced into every
// existing OU_SHRINKAGE_CONFIG league entry above — the two configs share no
// fields for any league, so a per-key shallow merge is exact and this avoids
// hand-editing ~50 existing entries.
const CLEAN_SHEET_WIN_EITHER_HALF_SHRINKAGE: Record<
  string,
  Pick<
    OverUnderShrinkageConfig,
    | "cleanSheetHome"
    | "cleanSheetAway"
    | "winEitherHalfHome"
    | "winEitherHalfAway"
  >
> = {
  ARG1: {
    cleanSheetHome: { factor: 0.39, base: 0.41 },
    winEitherHalfHome: { factor: 0.29, base: 0.51 },
    winEitherHalfAway: { factor: 0.35, base: 0.4 },
  },
  ARG2: {
    cleanSheetHome: { factor: 0.34, base: 0.5 },
    cleanSheetAway: { factor: 0.55, base: 0.3 },
    winEitherHalfHome: { factor: 0.4, base: 0.57 },
    winEitherHalfAway: { factor: 0.48, base: 0.33 },
  },
  AUS1: {
    cleanSheetHome: { factor: 0.41, base: 0.21 },
    cleanSheetAway: { factor: 0.64, base: 0.22 },
    winEitherHalfHome: { factor: 0.7, base: 0.54 },
    winEitherHalfAway: { factor: 0.55, base: 0.55 },
  },
  AUT1: {
    cleanSheetHome: { factor: 0.57, base: 0.31 },
    cleanSheetAway: { factor: 0.24, base: 0.21 },
    winEitherHalfHome: { factor: 0.45, base: 0.57 },
    winEitherHalfAway: { factor: 0.72, base: 0.46 },
  },
  BEL1: {
    cleanSheetHome: { factor: 0.65, base: 0.32 },
    cleanSheetAway: { factor: 0.59, base: 0.23 },
    winEitherHalfAway: { factor: 0.77, base: 0.45 },
  },
  BRA2: {
    cleanSheetAway: { factor: 0.42, base: 0.22 },
    winEitherHalfHome: { factor: 0.35, base: 0.58 },
    winEitherHalfAway: { factor: 0.37, base: 0.41 },
  },
  CH: { cleanSheetAway: { factor: 0.57, base: 0.22 } },
  CHI1: {
    cleanSheetHome: { factor: 0.28, base: 0.3 },
    cleanSheetAway: { factor: 0.47, base: 0.2 },
    winEitherHalfHome: { factor: 0.86, base: 0.63 },
    winEitherHalfAway: { factor: 0.52, base: 0.46 },
  },
  CHI2: {
    cleanSheetHome: { factor: 0.54, base: 0.29 },
    cleanSheetAway: { factor: 0.31, base: 0.23 },
    winEitherHalfHome: { factor: 0.62, base: 0.54 },
    winEitherHalfAway: { factor: 0.28, base: 0.5 },
  },
  CHN2: {
    cleanSheetAway: { factor: 0.55, base: 0.23 },
    winEitherHalfAway: { factor: 0.8, base: 0.42 },
  },
  CSL: {
    cleanSheetAway: { factor: 0.71, base: 0.18 },
    winEitherHalfHome: { factor: 0.78, base: 0.62 },
  },
  D2: {
    cleanSheetAway: { factor: 0.56, base: 0.18 },
    winEitherHalfHome: { factor: 0.34, base: 0.61 },
  },
  D3: {
    cleanSheetHome: { factor: 0.32, base: 0.25 },
    cleanSheetAway: { factor: 0.61, base: 0.19 },
    winEitherHalfHome: { factor: 0.62, base: 0.62 },
    winEitherHalfAway: { factor: 0.57, base: 0.45 },
  },
  DEN1: {
    cleanSheetHome: { factor: 0.47, base: 0.25 },
    cleanSheetAway: { factor: 0.6, base: 0.18 },
    winEitherHalfAway: { factor: 0.74, base: 0.48 },
  },
  EL1: {
    cleanSheetHome: { factor: 0.7, base: 0.3 },
    winEitherHalfHome: { factor: 0.8, base: 0.59 },
  },
  F2: { cleanSheetHome: { factor: 0.34, base: 0.33 } },
  FIN1: {
    cleanSheetHome: { factor: 0.38, base: 0.25 },
    cleanSheetAway: { factor: 0.53, base: 0.22 },
    winEitherHalfHome: { factor: 0.56, base: 0.56 },
  },
  FIN2: { cleanSheetHome: { factor: 0.48, base: 0.2 } },
  I2: { winEitherHalfAway: { factor: 0.46, base: 0.42 } },
  IRL1: {
    cleanSheetHome: { factor: 0.27, base: 0.33 },
    winEitherHalfAway: { factor: 0.56, base: 0.44 },
    winEitherHalfHome: { factor: 0.84, base: 0.59 },
  },
  ISL1: {
    cleanSheetHome: { factor: 0.23, base: 0.22 },
    cleanSheetAway: { factor: 0.77, base: 0.15 },
    winEitherHalfHome: { factor: 0.8, base: 0.64 },
    winEitherHalfAway: { factor: 0.61, base: 0.48 },
  },
  J1: {
    cleanSheetHome: { factor: 0.67, base: 0.33 },
    cleanSheetAway: { factor: 0.41, base: 0.25 },
    winEitherHalfHome: { factor: 0.44, base: 0.54 },
    winEitherHalfAway: { factor: 0.61, base: 0.46 },
  },
  KOR2: {
    cleanSheetHome: { factor: 0.63, base: 0.27 },
    cleanSheetAway: { factor: 0.69, base: 0.29 },
    winEitherHalfHome: { factor: 0.62, base: 0.51 },
  },
  KSA1: { cleanSheetAway: { factor: 0.67, base: 0.2 } },
  MLS: {
    cleanSheetHome: { factor: 0.18, base: 0.26 },
    winEitherHalfHome: { factor: 0.55, base: 0.62 },
    winEitherHalfAway: { factor: 0.53, base: 0.48 },
  },
  MX1: {
    winEitherHalfHome: { factor: 0.87, base: 0.62 },
    winEitherHalfAway: { factor: 0.85, base: 0.41 },
  },
  NOR2: {
    cleanSheetAway: { factor: 0.56, base: 0.16 },
    winEitherHalfHome: { factor: 0.9, base: 0.61 },
    cleanSheetHome: { factor: 0.74, base: 0.23 },
    winEitherHalfAway: { factor: 0.86, base: 0.51 },
  },
  POL1: {
    cleanSheetAway: { factor: 0.25, base: 0.2 },
    winEitherHalfHome: { factor: 0.32, base: 0.59 },
    winEitherHalfAway: { factor: 0.47, base: 0.44 },
  },
  POL2: {
    cleanSheetHome: { factor: 0.68, base: 0.24 },
    winEitherHalfHome: { factor: 0.58, base: 0.57 },
    winEitherHalfAway: { factor: 0.77, base: 0.48 },
  },
  RUS1: { winEitherHalfAway: { factor: 0.66, base: 0.45 } },
  SCO1: {
    cleanSheetAway: { factor: 0.76, base: 0.19 },
    winEitherHalfHome: { factor: 0.79, base: 0.63 },
  },
  SP2: { winEitherHalfAway: { factor: 0.59, base: 0.41 } },
  SRB1: {
    cleanSheetHome: { factor: 0.64, base: 0.32 },
    winEitherHalfHome: { factor: 0.86, base: 0.55 },
  },
  SUI2: {
    cleanSheetHome: { factor: 0.47, base: 0.25 },
    winEitherHalfAway: { factor: 0.43, base: 0.49 },
  },
  SVN1: {
    cleanSheetHome: { factor: 0.79, base: 0.29 },
    winEitherHalfHome: { factor: 0.82, base: 0.63 },
  },
  SWE1: { cleanSheetHome: { factor: 0.46, base: 0.28 } },
  SWE2: {
    cleanSheetHome: { factor: 0.55, base: 0.29 },
    cleanSheetAway: { factor: 0.28, base: 0.23 },
    winEitherHalfHome: { factor: 0.58, base: 0.57 },
    winEitherHalfAway: { factor: 0.39, base: 0.46 },
  },
  TUR1: {
    cleanSheetHome: { factor: 0.56, base: 0.31 },
    cleanSheetAway: { factor: 0.67, base: 0.2 },
    winEitherHalfHome: { factor: 0.81, base: 0.62 },
  },
  TUR2: { cleanSheetAway: { factor: 0.73, base: 0.24 } },
  UECL: {
    cleanSheetHome: { factor: 0.58, base: 0.34 },
    winEitherHalfHome: { factor: 0.75, base: 0.57 },
    winEitherHalfAway: { factor: 0.6, base: 0.47 },
  },
  UEL: { cleanSheetHome: { factor: 0.02, base: 0.31 } },
  USA2: {
    cleanSheetHome: { factor: 0.5, base: 0.33 },
    cleanSheetAway: { factor: 0.28, base: 0.25 },
    winEitherHalfHome: { factor: 0.46, base: 0.58 },
    winEitherHalfAway: { factor: 0.64, base: 0.43 },
  },
  WCQSA: { winEitherHalfHome: { factor: 0.89, base: 0.62 } },
};

for (const [code, block] of Object.entries(
  CLEAN_SHEET_WIN_EITHER_HALF_SHRINKAGE,
)) {
  OU_SHRINKAGE_CONFIG[code] = {
    ...(OU_SHRINKAGE_CONFIG[code] ?? {}),
    ...block,
  };
}

// ouHt for the 7 htftCalibrated leagues (ev.constants.ts
// HTFT_CALIBRATED_LEAGUES) — the only leagues OverUnderHtStrategy/
// FirstHalfWinnerStrategy/HalfTimeFullTimeStrategy are allowed to run in.
// Found 2026-08-16: none of them had an ouHt block, so getOverUnderHtLineConfigs
// returned empty and the channel could never select anything in its only
// allowed leagues, despite 2+ years of real OVER_UNDER_HT odds since 2023.
// Unlike every other shrinkage block here, factor=1 (identity, no
// correction) is the CORRECT value, not a placeholder: the walk-forward
// backtest (db:backtest:over-under-ht-shrinkage-calibration, 2026-08-16)
// found the raw Poisson HT-total probability is already well-calibrated in
// all 7 leagues (ΔBrier ≈ 0.0000 — shrinking would not improve it, unlike
// the genuine overconfidence TEAM_TOTAL/RESULT_TOTAL_GOALS had at their own
// launch). `base` is the real settled HT-total-over rate (all finished
// fixtures with a known HT score), only used as the identity floor when
// factor=1 makes it a no-op on the shrink itself, but getOverUnderHtLineConfigs
// still needs it to derive a threshold (base − 0.05, TEAM_TOTAL's rule).
const OVER_UNDER_HT_UNSHRUNK_BASE: Record<string, OverUnderShrinkageConfig> = {
  BL1: { ouHt: { factor05: 1, base05: 0.78, factor15: 1, base15: 0.45 } },
  CH: { ouHt: { factor05: 1, base05: 0.69, factor15: 1, base15: 0.33 } },
  EL1: { ouHt: { factor05: 1, base05: 0.7, factor15: 1, base15: 0.32 } },
  L1: { ouHt: { factor05: 1, base05: 0.71, factor15: 1, base15: 0.35 } },
  LL: { ouHt: { factor05: 1, base05: 0.69, factor15: 1, base15: 0.32 } },
  PL: { ouHt: { factor05: 1, base05: 0.74, factor15: 1, base15: 0.37 } },
  SA: { ouHt: { factor05: 1, base05: 0.68, factor15: 1, base15: 0.31 } },
};

for (const [code, block] of Object.entries(OVER_UNDER_HT_UNSHRUNK_BASE)) {
  OU_SHRINKAGE_CONFIG[code] = {
    ...(OU_SHRINKAGE_CONFIG[code] ?? {}),
    ...block,
  };
}

// WIN_TO_NIL_HOME/AWAY, generated by db:backtest:win-to-nil-shrinkage-
// calibration (2026-08-19), see packages/db/reports/backtest-win-to-nil-
// shrinkage-calibration-2026-08-19.txt. Overlay pattern (see CLEAN_SHEET_
// WIN_EITHER_HALF_SHRINKAGE above) — shares no fields with any existing
// entry, so a per-key shallow merge is exact.
const WIN_TO_NIL_SHRINKAGE: Record<
  string,
  Pick<OverUnderShrinkageConfig, "winToNilHome" | "winToNilAway">
> = {
  ARG1: {
    winToNilAway: { factor: 0.27, base: 0.18 },
    winToNilHome: { factor: 0.37, base: 0.27 },
  },
  ARG2: {
    winToNilAway: { factor: 0.44, base: 0.15 },
    winToNilHome: { factor: 0.33, base: 0.33 },
  },
  AUS1: { winToNilAway: { factor: 0.41, base: 0.17 } },
  AUT1: {
    winToNilAway: { factor: 0.47, base: 0.13 },
    winToNilHome: { factor: 0.68, base: 0.23 },
  },
  BEL1: {
    winToNilAway: { factor: 0.55, base: 0.15 },
    winToNilHome: { factor: 0.62, base: 0.24 },
  },
  BRA2: { winToNilAway: { factor: 0.41, base: 0.13 } },
  CHI1: {
    winToNilAway: { factor: 0.47, base: 0.16 },
    winToNilHome: { factor: 0.36, base: 0.26 },
  },
  CHI2: {
    winToNilAway: { factor: 0, base: 0.17 },
    winToNilHome: { factor: 0.59, base: 0.24 },
  },
  CHN2: { winToNilAway: { factor: 0.71, base: 0.15 } },
  D2: { winToNilAway: { factor: 0.58, base: 0.12 } },
  D3: {
    winToNilAway: { factor: 0.67, base: 0.13 },
    winToNilHome: { factor: 0.27, base: 0.2 },
  },
  DEN1: {
    winToNilAway: { factor: 0.51, base: 0.12 },
    winToNilHome: { factor: 0.54, base: 0.2 },
  },
  EL1: { winToNilHome: { factor: 0.71, base: 0.23 } },
  FIN1: { winToNilHome: { factor: 0.65, base: 0.15 } },
  FIN2: { winToNilHome: { factor: 0.63, base: 0.16 } },
  I2: { winToNilAway: { factor: 0.55, base: 0.14 } },
  IRL1: { winToNilAway: { factor: 0.36, base: 0.13 } },
  ISL1: { winToNilHome: { factor: 0.32, base: 0.18 } },
  J1: {
    winToNilAway: { factor: 0.32, base: 0.18 },
    winToNilHome: { factor: 0.53, base: 0.26 },
  },
  KOR2: { winToNilHome: { factor: 0.61, base: 0.18 } },
  NOR2: {
    winToNilAway: { factor: 0.73, base: 0.12 },
    winToNilHome: { factor: 0.77, base: 0.19 },
  },
  POL1: { winToNilAway: { factor: 0.21, base: 0.14 } },
  POL2: {
    winToNilAway: { factor: 0.73, base: 0.16 },
    winToNilHome: { factor: 0.6, base: 0.19 },
  },
  RUS1: { winToNilAway: { factor: 0.8, base: 0.15 } },
  SCO1: { winToNilAway: { factor: 0.75, base: 0.14 } },
  SUI2: { winToNilHome: { factor: 0.65, base: 0.19 } },
  SVN1: { winToNilHome: { factor: 0.72, base: 0.22 } },
  SWE2: { winToNilAway: { factor: 0.54, base: 0.14 } },
  TUR1: {
    winToNilAway: { factor: 0.85, base: 0.13 },
    winToNilHome: { factor: 0.59, base: 0.23 },
  },
  UECL: { winToNilHome: { factor: 0.61, base: 0.28 } },
  UEL: { winToNilHome: { factor: 0.22, base: 0.28 } },
  USA2: {
    winToNilAway: { factor: 0.29, base: 0.16 },
    winToNilHome: { factor: 0.5, base: 0.23 },
  },
  WCQSA: { winToNilAway: { factor: 0.73, base: 0.12 } },
};

for (const [code, block] of Object.entries(WIN_TO_NIL_SHRINKAGE)) {
  OU_SHRINKAGE_CONFIG[code] = {
    ...(OU_SHRINKAGE_CONFIG[code] ?? {}),
    ...block,
  };
}

// DRAW_NO_BET (dnbHome), generated by db:backtest:draw-no-bet-shrinkage-
// calibration (2026-08-19), see packages/db/reports/backtest-draw-no-bet-
// shrinkage-calibration-2026-08-19.txt.
const DRAW_NO_BET_SHRINKAGE: Record<
  string,
  Pick<OverUnderShrinkageConfig, "dnbHome">
> = {
  ARG1: { dnbHome: { factor: 0.32, base: 0.59 } },
  ARG2: { dnbHome: { factor: 0.5, base: 0.69 } },
  AUS1: { dnbHome: { factor: 0.54, base: 0.48 } },
  AUT1: { dnbHome: { factor: 0.63, base: 0.59 } },
  BEL1: { dnbHome: { factor: 0.77, base: 0.57 } },
  BRA2: { dnbHome: { factor: 0.36, base: 0.64 } },
  CHI1: { dnbHome: { factor: 0.74, base: 0.62 } },
  CHI2: { dnbHome: { factor: 0.49, base: 0.55 } },
  D3: { dnbHome: { factor: 0.66, base: 0.62 } },
  DEN1: { dnbHome: { factor: 0.73, base: 0.6 } },
  EL1: { dnbHome: { factor: 0.79, base: 0.59 } },
  FIN1: { dnbHome: { factor: 0.84, base: 0.57 } },
  I2: { dnbHome: { factor: 0.66, base: 0.63 } },
  IRL1: { dnbHome: { factor: 0.67, base: 0.6 } },
  ISL1: { dnbHome: { factor: 0.74, base: 0.63 } },
  J1: { dnbHome: { factor: 0.49, base: 0.57 } },
  KOR2: { dnbHome: { factor: 0.74, base: 0.5 } },
  MLS: { dnbHome: { factor: 0.61, base: 0.6 } },
  NOR2: { dnbHome: { factor: 0.9, base: 0.57 } },
  POL1: { dnbHome: { factor: 0.35, base: 0.61 } },
  POL2: { dnbHome: { factor: 0.82, base: 0.55 } },
  RUS1: { dnbHome: { factor: 0.88, base: 0.61 } },
  SCO1: { dnbHome: { factor: 0.82, base: 0.61 } },
  SP2: { dnbHome: { factor: 0.63, base: 0.63 } },
  SRB1: { dnbHome: { factor: 0.87, base: 0.56 } },
  SVN1: { dnbHome: { factor: 0.81, base: 0.6 } },
  SWE1: { dnbHome: { factor: 0.76, base: 0.55 } },
  SWE2: { dnbHome: { factor: 0.73, base: 0.59 } },
  TUR1: { dnbHome: { factor: 0.89, base: 0.63 } },
  TUR2: { dnbHome: { factor: 0.87, base: 0.6 } },
  UECL: { dnbHome: { factor: 0.66, base: 0.57 } },
  USA2: { dnbHome: { factor: 0.59, base: 0.61 } },
};

for (const [code, block] of Object.entries(DRAW_NO_BET_SHRINKAGE)) {
  OU_SHRINKAGE_CONFIG[code] = {
    ...(OU_SHRINKAGE_CONFIG[code] ?? {}),
    ...block,
  };
}

// RESULT_BTTS (ex. HOME_YES/HOME_NO), generated by db:backtest:result-btts-
// shrinkage-calibration (2026-08-19), see packages/db/reports/backtest-
// result-btts-shrinkage-calibration-2026-08-19.txt.
const RESULT_BTTS_SHRINKAGE: Record<
  string,
  Pick<OverUnderShrinkageConfig, "resultBtts">
> = {
  ARG1: { resultBtts: { AWAY: { factor: 0.27, base: 0.1 } } },
  AUS1: { resultBtts: { HOME: { factor: 0.28, base: 0.19 } } },
  BRA2: { resultBtts: { HOME: { factor: 0.5, base: 0.16 } } },
  CHI2: {
    resultBtts: {
      DRAW: { factor: 0, base: 0.16 },
      HOME: { factor: 0.42, base: 0.18 },
    },
  },
  CHN2: { resultBtts: { HOME: { factor: 0.71, base: 0.21 } } },
  F2: { resultBtts: { AWAY: { factor: 0.24, base: 0.12 } } },
  FIN1: {
    resultBtts: {
      AWAY: { factor: 0.56, base: 0.16 },
      DRAW: { factor: 0, base: 0.17 },
    },
  },
  GRE1: { resultBtts: { HOME: { factor: 0.54, base: 0.18 } } },
  I2: { resultBtts: { AWAY: { factor: 0.41, base: 0.11 } } },
  IRL1: { resultBtts: { DRAW: { factor: 0, base: 0.2 } } },
  ISL1: { resultBtts: { AWAY: { factor: 0.54, base: 0.15 } } },
  J1: {
    resultBtts: {
      AWAY: { factor: 0.27, base: 0.13 },
      DRAW: { factor: 0, base: 0.18 },
      HOME: { factor: 0.5, base: 0.18 },
    },
  },
  KOR2: {
    resultBtts: {
      DRAW: { factor: 0.52, base: 0.23 },
      HOME: { factor: 0.29, base: 0.15 },
    },
  },
  MLS: { resultBtts: { HOME: { factor: 0.86, base: 0.25 } } },
  NOR1: { resultBtts: { HOME: { factor: 0.65, base: 0.23 } } },
  POL1: {
    resultBtts: {
      AWAY: { factor: 0.19, base: 0.15 },
      HOME: { factor: 0.22, base: 0.23 },
    },
  },
  POL2: { resultBtts: { DRAW: { factor: 0, base: 0.21 } } },
  SVN1: { resultBtts: { AWAY: { factor: 0.5, base: 0.15 } } },
  SWE1: {
    resultBtts: {
      AWAY: { factor: 0.48, base: 0.19 },
      DRAW: { factor: 0, base: 0.17 },
      HOME: { factor: 0.53, base: 0.2 },
    },
  },
  SWE2: {
    resultBtts: {
      AWAY: { factor: 0.2, base: 0.16 },
      HOME: { factor: 0.24, base: 0.21 },
    },
  },
  TUR2: { resultBtts: { HOME: { factor: 0.46, base: 0.16 } } },
  // UCL/UEL/UECL DRAW re-fit 2026-08-19, pooled across the three (same
  // structural pattern — continental cup away legs — each individually too
  // thin: UCL/UEL had no resultBtts shrinkage at all, UECL's DRAW existed
  // but on 1/3 the sample). AWAY retiré : le train UECL seul avait trouvé
  // factor=0.52 (ΔBrier -0.0011), mais le même protocole sur l'échantillon
  // triplé (pooling) ne trouve plus d'amélioration Brier significative
  // (+0.0005) — le signal AWAY à l'ancienne mesure était probablement du
  // bruit sur un train trop petit, pas un vrai biais de la proba Poisson
  // brute (confirmé par l'audit replay : le ROI dégradé de RESULT_BTTS AWAY
  // en coupes UEFA reste mauvais même aux tranches d'edge les plus basses,
  // cohérent avec un problème de SEUIL de sélection Phase 1
  // (result-btts.config.ts), pas de calibration de proba — reste à traiter
  // séparément, voir TODO.md).
  UCL: { resultBtts: { DRAW: { factor: 0.5, base: 0.13 } } },
  UEL: { resultBtts: { DRAW: { factor: 0.5, base: 0.13 } } },
  UECL: { resultBtts: { DRAW: { factor: 0.5, base: 0.13 } } },
  USA2: {
    resultBtts: {
      AWAY: { factor: 0.5, base: 0.12 },
      HOME: { factor: 0.68, base: 0.21 },
    },
  },
  WCQSA: { resultBtts: { HOME: { factor: 0, base: 0.13 } } },
};

for (const [code, block] of Object.entries(RESULT_BTTS_SHRINKAGE)) {
  OU_SHRINKAGE_CONFIG[code] = {
    ...(OU_SHRINKAGE_CONFIG[code] ?? {}),
    ...block,
  };
}

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

  if (config.resultTotalGoals) {
    result.resultTotalGoals = shrinkResultTotalGoals(
      probabilities.resultTotalGoals,
      {
        HOME: probabilities.home,
        DRAW: probabilities.draw,
        AWAY: probabilities.away,
      },
      config.resultTotalGoals,
    );
  }

  if (config.cleanSheetHome) {
    result.cleanSheetHome = shrinkWith(
      probabilities.cleanSheetHome,
      config.cleanSheetHome.base,
      config.cleanSheetHome.factor,
    );
  }
  if (config.cleanSheetAway) {
    result.cleanSheetAway = shrinkWith(
      probabilities.cleanSheetAway,
      config.cleanSheetAway.base,
      config.cleanSheetAway.factor,
    );
  }
  if (config.winEitherHalfHome) {
    result.winEitherHalfHome = shrinkWith(
      probabilities.winEitherHalfHome,
      config.winEitherHalfHome.base,
      config.winEitherHalfHome.factor,
    );
  }
  if (config.winEitherHalfAway) {
    result.winEitherHalfAway = shrinkWith(
      probabilities.winEitherHalfAway,
      config.winEitherHalfAway.base,
      config.winEitherHalfAway.factor,
    );
  }

  if (config.winToNilHome) {
    result.winToNilHome = shrinkWith(
      probabilities.winToNilHome,
      config.winToNilHome.base,
      config.winToNilHome.factor,
    );
  }
  if (config.winToNilAway) {
    result.winToNilAway = shrinkWith(
      probabilities.winToNilAway,
      config.winToNilAway.base,
      config.winToNilAway.factor,
    );
  }

  if (config.dnbHome) {
    const dnbHome = shrinkWith(
      probabilities.dnbHome,
      config.dnbHome.base,
      config.dnbHome.factor,
    );
    result.dnbHome = dnbHome;
    result.dnbAway = new Decimal(1).minus(dnbHome);
  }

  if (config.resultBtts) {
    result.resultBtts = shrinkResultBtts(
      probabilities.resultBtts,
      {
        HOME: probabilities.home,
        DRAW: probabilities.draw,
        AWAY: probabilities.away,
      },
      config.resultBtts,
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

const RESULT_TOTAL_GOALS_LINES = ["15", "25", "35", "45"] as const;

// Shrinks the UNDER joint probability (the pure joint-distribution sum,
// unaffected by 1X2 rebalancing) toward its own measured base rate, then
// recomputes OVER = sideMass − shrunkUnder — the same relationship
// rebalanceThreeWayProbabilities already maintains when home/draw/away move.
// Clamped to [0, sideMass], not [0, 1]: OVER can never exceed the side's own
// win probability.
function shrinkResultTotalGoals(
  proba: ResultTotalGoalsProba,
  sideProbability: { HOME: Decimal; DRAW: Decimal; AWAY: Decimal },
  block: ResultTotalGoalsShrinkageBlock,
): ResultTotalGoalsProba {
  const result: ResultTotalGoalsProba = { ...proba };
  for (const side of ["HOME", "DRAW", "AWAY"] as const) {
    const sideBlock = block[side];
    if (!sideBlock) continue;
    for (const lineKey of RESULT_TOTAL_GOALS_LINES) {
      const lineConfig = sideBlock[lineKey];
      if (!lineConfig) continue;
      const line = `${lineKey[0]}_${lineKey[1]}` as
        | "1_5"
        | "2_5"
        | "3_5"
        | "4_5";
      const underKey = `${side}_UNDER_${line}` as keyof ResultTotalGoalsProba;
      const overKey = `${side}_OVER_${line}` as keyof ResultTotalGoalsProba;
      const rawUnder = proba[underKey];
      if (rawUnder === undefined) continue;
      const shrunkUnder = shrinkWith(
        rawUnder,
        lineConfig.base,
        lineConfig.factor,
      );
      result[underKey] = shrunkUnder;
      if (proba[overKey] !== undefined) {
        result[overKey] = Decimal.max(
          0,
          sideProbability[side].minus(shrunkUnder),
        );
      }
    }
  }
  return result;
}

// Same relationship as shrinkResultTotalGoals, no line dimension: shrinks
// the YES joint probability per side toward its measured base, then
// recomputes NO = sideMass − shrunkYes (clamped to [0, sideMass], never
// [0, 1] — NO can't exceed the side's own win probability).
function shrinkResultBtts(
  proba: ResultBttsProba,
  sideProbability: { HOME: Decimal; DRAW: Decimal; AWAY: Decimal },
  block: Partial<
    Record<"HOME" | "DRAW" | "AWAY", { factor: number; base: number }>
  >,
): ResultBttsProba {
  const result: ResultBttsProba = { ...proba };
  for (const side of ["HOME", "DRAW", "AWAY"] as const) {
    const sideConfig = block[side];
    if (!sideConfig) continue;
    const yesKey = `${side}_YES` as keyof ResultBttsProba;
    const noKey = `${side}_NO` as keyof ResultBttsProba;
    const rawYes = proba[yesKey];
    if (rawYes === undefined) continue;
    const shrunkYes = shrinkWith(rawYes, sideConfig.base, sideConfig.factor);
    result[yesKey] = shrunkYes;
    if (proba[noKey] !== undefined) {
      result[noKey] = Decimal.max(0, sideProbability[side].minus(shrunkYes));
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
