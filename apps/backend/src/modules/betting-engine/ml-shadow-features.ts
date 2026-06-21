import Decimal from 'decimal.js';
import { asNumber } from './betting-engine.utils';
import type { DeterministicFeatures } from './betting-engine.utils';
import type { MlShadowFeatures } from '@modules/ml/ml.inference.service';
import type { MatchProbabilities, ViablePick } from './betting-engine.types';

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
  const {
    valueBet,
    deterministicScore,
    probabilities,
    features,
    competitionCode,
  } = input;
  return {
    prob_estimated: valueBet.probability.toNumber(),
    deterministic_score: deterministicScore.toNumber(),
    ev: valueBet.ev.toNumber(),
    delta_p: null,
    p_poisson_home: probabilities.home.toNumber(),
    p_poisson_draw: probabilities.draw.toNumber(),
    p_poisson_away: probabilities.away.toNumber(),
    recent_form: asNumber(features.recentForm),
    xg: asNumber(features.xg),
    performance_dom_ext: asNumber(features.domExtPerf),
    volatilite_ligue: asNumber(features.leagueVolat),
    market: valueBet.market,
    canal: 'EV',
    league_tier: mlLeagueTier(competitionCode),
    odds_segment: mlOddsSegment(valueBet.odds),
  };
}
