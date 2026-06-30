import type Decimal from "decimal.js";
import type { Market, ModelRunPhase, SportType } from "../types";
import { MODEL_RUN_PHASE } from "../types";
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from "../selection/types";
import type { SelectionConfig } from "../selection/config";
import type {
  ContextSignals,
  EvaluatedMarket,
  FixtureSnapshot,
  StrategyContext,
} from "./types";

export type BuildStrategyContextInput = {
  fixture: FixtureSnapshot;
  competitionCode: string | null;
  deterministicScore: Decimal;
  probabilities: MatchProbabilities;
  lambdaHome?: number;
  lambdaAway?: number;
  evaluatedPicks: readonly EvaluatedPick[];
  odds: FullOddsSnapshot | null;
  signals: ContextSignals;
  phase?: ModelRunPhase;
  // [multi-sport] FOOTBALL until a second sport's scoring base exists (doc §1).
  sport?: SportType;
  // Pre-built from app-side league lookup tables (ev.constants).
  selectionConfig: SelectionConfig;
  modelScoreThreshold: Decimal;
};

// Assembles the immutable StrategyContext consumed by every channel strategy
// from the artifacts the betting engine has already computed for one ModelRun.
// Pure — no I/O, no decision logic.
export function buildStrategyContext(
  input: BuildStrategyContextInput,
): StrategyContext {
  return {
    fixture: input.fixture,
    competitionCode: input.competitionCode,
    sport: input.sport ?? "FOOTBALL",
    phase: input.phase ?? MODEL_RUN_PHASE.PRE_KICKOFF,
    deterministicScore: input.deterministicScore,
    probabilities: input.probabilities,
    lambdaHome: input.lambdaHome,
    lambdaAway: input.lambdaAway,
    evaluatedMarkets: groupPicksByMarket(input.evaluatedPicks),
    odds: input.odds,
    signals: input.signals,
    previousDecisions: new Map(),
    selectionConfig: input.selectionConfig,
    modelScoreThreshold: input.modelScoreThreshold,
  };
}

function groupPicksByMarket(
  picks: readonly EvaluatedPick[],
): EvaluatedMarket[] {
  const byMarket = new Map<Market, EvaluatedPick[]>();
  for (const pick of picks) {
    const bucket = byMarket.get(pick.market);
    if (bucket) {
      bucket.push(pick);
    } else {
      byMarket.set(pick.market, [pick]);
    }
  }
  return [...byMarket.entries()].map(([market, marketPicks]) => ({
    market,
    picks: marketPicks,
  }));
}
