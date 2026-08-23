import { getOverUnderShrinkageConfig } from "../probability";

// ─────────────────────────────────────────────
// OVER_UNDER_HT — first-half goals line (2026-08-16), same shape as GOALS but
// restricted to the 0.5/1.5 lines already covered by half-time O/U shrinkage.
// Unlike RESULT_TOTAL_GOALS, `ouHt` base rates are genuine marginal
// probabilities (P(over) complements P(under) = 1 − P(over)), same magnitude
// range as GOALS/TEAM_TOTAL — so this reuses TEAM_TOTAL's exact curation
// rule instead of RESULT_TOTAL_GOALS' relative-margin one: side = OVER when
// base ≥ 0.55, UNDER when base ≤ 0.45 (the 0.45–0.55 band is dropped as
// uninformative — model has no real lean either way), threshold = (chosen
// side's base rate) − 0.05. No hand-curated table: mechanically derived from
// `OU_SHRINKAGE_CONFIG[code].ouHt` (already walk-forward Brier-validated,
// already live) exactly like RESULT_TOTAL_GOALS_CONFIG above — same
// deliberate coupling, same rationale (avoid a second base-rate audit).
// OBSERVATION mode, no ROI backtest yet — SafeStrategy already lists
// OVER_UNDER_HT among its allowedMarkets as a secondary filter, but this is
// its first dedicated channel.
// ─────────────────────────────────────────────

export type OverUnderHtLine = "0_5" | "1_5";
export type OverUnderHtSide = "OVER" | "UNDER";

export type OverUnderHtLineConfig = {
  line: OverUnderHtLine;
  side: OverUnderHtSide;
  threshold: number;
  enabled: boolean;
};

const OVER_UNDER_HT_MARGIN = 0.05;
const OVER_UNDER_HT_OVER_FLOOR = 0.55;
const OVER_UNDER_HT_UNDER_CEILING = 0.45;

function deriveOverUnderHtLineConfig(
  line: OverUnderHtLine,
  base: number | undefined,
): OverUnderHtLineConfig | null {
  if (base === undefined) return null;
  if (base >= OVER_UNDER_HT_OVER_FLOOR) {
    return {
      line,
      side: "OVER",
      threshold: base - OVER_UNDER_HT_MARGIN,
      enabled: true,
    };
  }
  if (base <= OVER_UNDER_HT_UNDER_CEILING) {
    const underBase = 1 - base;
    return {
      line,
      side: "UNDER",
      threshold: underBase - OVER_UNDER_HT_MARGIN,
      enabled: true,
    };
  }
  return null;
}

// Resolve the enabled OVER_UNDER_HT line configs for a league, derived
// mechanically from OU_SHRINKAGE_CONFIG (empty when the league has no ouHt
// shrinkage block).
export function getOverUnderHtLineConfigs(
  competitionCode: string | null | undefined,
): readonly OverUnderHtLineConfig[] {
  const ouHt = getOverUnderShrinkageConfig(competitionCode)?.ouHt;
  if (!ouHt) return [];

  const configs: OverUnderHtLineConfig[] = [];
  const half = deriveOverUnderHtLineConfig("0_5", ouHt.base05);
  if (half) configs.push(half);
  const oneHalf = deriveOverUnderHtLineConfig("1_5", ouHt.base15);
  if (oneHalf) configs.push(oneHalf);
  return configs;
}
