// buildStrategyContext is now a pure core function (analysis-core/strategies).
// This wrapper enriches the input with app-side league config before delegating.
import {
  buildStrategyContext as coreBuilder,
  type BuildStrategyContextInput,
  type StrategyContext,
} from '@evcore/analysis-core';
import { buildSelectionConfig } from '../selection/selection-config';
import { getModelScoreThreshold } from '../ev.constants';

export type { BuildStrategyContextInput, StrategyContext };

// Re-export core types that callers import from this module.
export type {
  ContextSignals,
  EvaluatedMarket,
  FixtureSnapshot,
  ModelRunPhase,
  SportType,
} from '@evcore/analysis-core';
export { MODEL_RUN_PHASE } from '@evcore/analysis-core';

type AppBuildInput = Omit<
  BuildStrategyContextInput,
  'selectionConfig' | 'modelScoreThreshold'
>;

export function buildStrategyContext(input: AppBuildInput): StrategyContext {
  return coreBuilder({
    ...input,
    selectionConfig: buildSelectionConfig(input.competitionCode),
    modelScoreThreshold: getModelScoreThreshold(input.competitionCode),
  });
}
