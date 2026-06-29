// ML correction-layer feature vector — the exchange contract between the
// deterministic NestJS scoring and the Python ml-worker (BullMQ / Postgres).
// Keeping it here makes drift between producer and consumer impossible to miss.
import Decimal from 'decimal.js';
import type { MatchProbabilities } from '../selection/types';
import type { ViablePick } from '../selection/types';
import type { DeterministicFeatures } from './deterministic-score';

export type MlShadowFeatures = {
  prob_estimated: number;
  deterministic_score: number;
  ev: number;
  delta_p: number | null;
  p_poisson_home: number;
  p_poisson_draw: number;
  p_poisson_away: number;
  recent_form: number;
  xg: number;
  performance_dom_ext: number;
  volatilite_ligue: number;
  market: string;
  canal: string;
  league_tier: string;
  odds_segment: string;
};

const TOP5_COMPETITIONS = new Set(['PL', 'PD', 'BL1', 'SA', 'FL1']);
const INTERNATIONAL_COMPETITIONS = new Set(['WC', 'UCL', 'UEL', 'UECL', 'FRI']);

function mlLeagueTier(competitionCode: string | null): string {
  if (!competitionCode) return 'secondary';
  if (TOP5_COMPETITIONS.has(competitionCode)) return 'top5';
  if (INTERNATIONAL_COMPETITIONS.has(competitionCode)) return 'international';
  return 'secondary';
}

function mlOddsSegment(odds: Decimal): string {
  const n = odds.toNumber();
  if (n < 1.5) return 'low';
  if (n <= 2.5) return 'mid';
  return 'high';
}

export function buildMlShadowFeatures(input: {
  valueBet: ViablePick;
  deterministicScore: Decimal;
  probabilities: MatchProbabilities;
  features: DeterministicFeatures;
  competitionCode: string | null;
}): MlShadowFeatures {
  const { valueBet, deterministicScore, probabilities, features, competitionCode } = input;
  return {
    prob_estimated: valueBet.probability.toNumber(),
    deterministic_score: deterministicScore.toNumber(),
    ev: valueBet.ev.toNumber(),
    delta_p: null,
    p_poisson_home: probabilities.home.toNumber(),
    p_poisson_draw: probabilities.draw.toNumber(),
    p_poisson_away: probabilities.away.toNumber(),
    recent_form: new Decimal(features.recentForm).toNumber(),
    xg: new Decimal(features.xg).toNumber(),
    performance_dom_ext: new Decimal(features.domExtPerf).toNumber(),
    volatilite_ligue: new Decimal(features.leagueVolat).toNumber(),
    market: valueBet.market,
    canal: 'VALUE',
    league_tier: mlLeagueTier(competitionCode),
    odds_segment: mlOddsSegment(valueBet.odds),
  };
}
