import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  computePoissonMarkets,
  calculateDeterministicScore,
  type DeterministicFeatures,
} from './betting-engine.utils';

export type MatchProbabilities = ReturnType<typeof computePoissonMarkets>;

@Injectable()
export class BettingEngineService {
  computeProbabilities(
    lambdaHome: number,
    lambdaAway: number,
  ): MatchProbabilities {
    return computePoissonMarkets(lambdaHome, lambdaAway);
  }

  calculateDeterministicScore(features: DeterministicFeatures): Decimal {
    return calculateDeterministicScore(features);
  }
}
