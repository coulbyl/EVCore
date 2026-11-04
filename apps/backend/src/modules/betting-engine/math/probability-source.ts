// Which model gives a fixture's probabilities (lot ML-1,
// docs/audits/2026-11-04/ML1-GRILLE-MARCHE.md): the market grid when a
// sharp book prices a 1X2 and a total-goals line coherently, the statistics
// engine otherwise. One place decides it, so the λ, the probabilities, the
// raw Poisson reference and the correction flags written to
// model_run.features always describe the same source.
import {
  computePoissonMarkets,
  type MarketGridResult,
} from '@evcore/analysis-core';
import type {
  MatchProbabilities,
  PredictionSource,
} from '../betting-engine.types';

/** The statistics engine's corrections, as they ran on its own output. */
export type AppliedCorrections = {
  /** λ nudged toward the H2H-dominant side. */
  h2hLambda: boolean;
  /** Per-market logit shift from the H2H rates. */
  h2hMarketSignals: boolean;
  /** Logit shift from schedule congestion. */
  congestion: boolean;
};

export type ResolvedProbabilitySource = {
  source: PredictionSource;
  lambda: { home: number; away: number };
  probabilities: MatchProbabilities;
  /**
   * Poisson output of `lambda` before the source's own adjustments — the
   * reference of the analysis sheet's adjustmentDelta. Statistics: before
   * the 1X2 blend and the O/U shrinkage. Grid: the pure grid, before its
   * 1X2 is replaced by the book's fair 1X2.
   */
  rawProbabilities: MatchProbabilities;
  /** Corrections that shaped `probabilities`: none under the grid. */
  appliedCorrections: AppliedCorrections;
};

const NO_CORRECTION: AppliedCorrections = {
  h2hLambda: false,
  h2hMarketSignals: false,
  congestion: false,
};

export function resolveProbabilitySource(input: {
  marketGrid: MarketGridResult;
  stats: {
    lambda: { home: number; away: number };
    probabilities: MatchProbabilities;
    rawProbabilities: MatchProbabilities;
    appliedCorrections: AppliedCorrections;
  };
}): ResolvedProbabilitySource {
  const { marketGrid, stats } = input;
  if (marketGrid.status !== 'ok') {
    return { source: 'POISSON_MAIN', ...stats };
  }
  const lambda = {
    home: marketGrid.fit.lambdaHome,
    away: marketGrid.fit.lambdaAway,
  };
  return {
    source: 'MARKET_GRID',
    lambda,
    probabilities: marketGrid.probabilities,
    rawProbabilities: computePoissonMarkets(lambda.home, lambda.away),
    // The grid is read off the prices: the H2H and congestion corrections
    // were computed on the statistics output and are discarded with it.
    appliedCorrections: NO_CORRECTION,
  };
}
