// Channel selection pricing now lives in the pure core
// (@evcore/analysis-core/selection). Re-exported here so existing imports
// against './selection-odds' keep resolving unchanged.
export {
  resolveSelectionOdds,
  priceSelection,
  priceForSelection,
} from '@evcore/analysis-core';
