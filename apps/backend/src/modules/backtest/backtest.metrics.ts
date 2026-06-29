// Pure ROI/drawdown helpers now live in @evcore/analysis-core/metrics.
// Re-exported here so existing backend imports keep resolving unchanged.
export {
  flatRoi,
  maxDrawdown,
  evBins,
  type EvBin,
  type Settled,
} from '@evcore/analysis-core';
