import type Decimal from 'decimal.js';
import type { Market } from '@evcore/db';
import type {
  EvaluatedPick,
  FullOddsSnapshot,
  MatchProbabilities,
} from '../betting-engine.types';
import type {
  ContextSignals,
  EvaluatedMarket,
  FixtureSnapshot,
  SportType,
  StrategyContext,
} from '../channel-strategy.types';

export type BuildStrategyContextInput = {
  fixture: FixtureSnapshot;
  competitionCode: string | null;
  deterministicScore: Decimal;
  probabilities: MatchProbabilities;
  evaluatedPicks: readonly EvaluatedPick[];
  odds: FullOddsSnapshot | null;
  signals: ContextSignals;
  // [multi-sport] FOOTBALL until a second sport's scoring base exists (doc §1).
  sport?: SportType;
};

/**
 * Assembles the immutable {@link StrategyContext} consumed by every channel
 * strategy (doc §5) from the artifacts the betting engine has already computed
 * for one ModelRun. Pure — no I/O, no decision logic.
 */
export function buildStrategyContext(
  input: BuildStrategyContextInput,
): StrategyContext {
  return {
    fixture: input.fixture,
    competitionCode: input.competitionCode,
    sport: input.sport ?? 'FOOTBALL',
    deterministicScore: input.deterministicScore,
    probabilities: input.probabilities,
    evaluatedMarkets: groupPicksByMarket(input.evaluatedPicks),
    odds: input.odds,
    signals: input.signals,
    // Phase-1 strategies start from an empty map; the orchestrator threads in
    // the running phase-1 decisions before each phase-2 strategy (doc §5).
    previousDecisions: new Map(),
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
