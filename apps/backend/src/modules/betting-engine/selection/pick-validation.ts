// Pick validation (getPickRejectionReason) and quality scoring (buildQualityScore)
// now live in the pure core (@evcore/analysis-core/selection). Re-exported here so
// existing './pick-validation' imports keep resolving. The summarize* helpers are
// app-side presentation (logging) and stay local.
export {
  getPickRejectionReason,
  buildQualityScore,
} from '@evcore/analysis-core';

import type { EvaluatedPick, ViablePick } from '../betting-engine.types';

export function summarizePick(pick: ViablePick): {
  market: string;
  pick: string;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
} {
  return {
    market: pick.market,
    pick: pick.pick,
    probability: pick.probability.toNumber(),
    odds: pick.odds.toNumber(),
    ev: pick.ev.toNumber(),
    qualityScore: pick.qualityScore.toNumber(),
  };
}

export function summarizePicks(picks: ViablePick[]): {
  market: string;
  pick: string;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
}[] {
  return picks.map((pick) => summarizePick(pick));
}

export function summarizeEvaluatedPicks(picks: EvaluatedPick[]): {
  market: string;
  pick: string;
  probability: number;
  odds: number;
  ev: number;
  qualityScore: number;
  status: 'viable' | 'rejected';
  rejectionReason?: string;
}[] {
  return picks.map((pick) => ({
    ...summarizePick(pick),
    status: pick.rejectionReason ? 'rejected' : 'viable',
    ...(pick.rejectionReason ? { rejectionReason: pick.rejectionReason } : {}),
  }));
}
