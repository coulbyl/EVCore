import { getOverUnderShrinkageConfig } from "../probability";

// ─────────────────────────────────────────────
// RESULT_TOTAL_GOALS — pre-combined result×goals-line pick (e.g.
// "HOME_UNDER_2_5"), priced against a genuine joint bookmaker odd (2026-08-16,
// OBSERVATION mode). Only the UNDER pick is covered: it's the sole joint
// probability directly walk-forward Brier-validated by
// `db:backtest:joint-probability-calibration`'s sibling
// `backtest-result-total-goals-shrinkage-calibration.ts` — the OVER pick for
// the same (side, line) is *derived* (`oneXTwo[side] − shrunkUnder`, see
// `shrinkResultTotalGoals`), not independently validated, so it isn't given
// its own config entry here.
//
// No hand-curated base-rate table like TEAM_TOTAL_CONFIG above: this reads
// directly off `OU_SHRINKAGE_CONFIG[code].resultTotalGoals` (already
// walk-forward validated, already live) rather than re-deriving base rates
// from scratch. Deliberate coupling — any future re-run of that shrinkage
// backtest silently moves these thresholds too; that's intended, not a bug.
//
// Threshold = base rate × 0.85 (15% relative margin). TEAM_TOTAL's flat
// `base − 0.05` doesn't transfer: TEAM_TOTAL's base rates are marginal
// probabilities clustering near 0.5, while RESULT_TOTAL_GOALS' base rates are
// three-way-result × goals-line JOINT probabilities running ~0.03–0.44 — a
// flat subtraction would go negative at the low end. Not itself
// ROI-backtested yet, same as TEAM_TOTAL's original launch threshold.
// ─────────────────────────────────────────────

export type ResultTotalGoalsSide = "HOME" | "DRAW" | "AWAY";
export type ResultTotalGoalsLine = "1_5" | "2_5" | "3_5" | "4_5";

export type ResultTotalGoalsLineConfig = {
  side: ResultTotalGoalsSide;
  line: ResultTotalGoalsLine;
  threshold: number;
  enabled: boolean;
};

const RESULT_TOTAL_GOALS_THRESHOLD_FACTOR = 0.85;
const RESULT_TOTAL_GOALS_SIDES: readonly ResultTotalGoalsSide[] = [
  "HOME",
  "DRAW",
  "AWAY",
];
// OU_SHRINKAGE_CONFIG's resultTotalGoals block keys the line without the
// underscore ("15"/"25"/"35"/"45"), while the pick string used across
// probabilities/odds/settlement uses "1_5" style (ResultTotalGoalsLine) — map
// between the two here rather than changing either existing convention.
const RESULT_TOTAL_GOALS_LINES: readonly [
  ResultTotalGoalsLine,
  "15" | "25" | "35" | "45",
][] = [
  ["1_5", "15"],
  ["2_5", "25"],
  ["3_5", "35"],
  ["4_5", "45"],
];

// Resolve the enabled RESULT_TOTAL_GOALS (UNDER-only) line configs for a
// league, derived mechanically from OU_SHRINKAGE_CONFIG (empty when the
// league has no resultTotalGoals shrinkage block).
export function getResultTotalGoalsLineConfigs(
  competitionCode: string | null | undefined,
): readonly ResultTotalGoalsLineConfig[] {
  const shrinkageConfig = getOverUnderShrinkageConfig(competitionCode);
  const resultTotalGoals = shrinkageConfig?.resultTotalGoals;
  if (!resultTotalGoals) return [];

  const configs: ResultTotalGoalsLineConfig[] = [];
  for (const side of RESULT_TOTAL_GOALS_SIDES) {
    const sideBlock = resultTotalGoals[side];
    if (!sideBlock) continue;
    for (const [line, shrinkageKey] of RESULT_TOTAL_GOALS_LINES) {
      const entry = sideBlock[shrinkageKey];
      if (!entry) continue;
      configs.push({
        side,
        line,
        threshold: entry.base * RESULT_TOTAL_GOALS_THRESHOLD_FACTOR,
        enabled: true,
      });
    }
  }
  return configs;
}
