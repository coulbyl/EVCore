import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  poissonProba,
  calculateDeterministicScore,
  deriveMarketsFromPoisson,
} from './betting-engine.utils';
import { BettingEngineService } from './betting-engine.service';

describe('poissonProba', () => {
  it('returns probabilities that sum close to 1', () => {
    const { home, draw, away } = poissonProba(1.5, 1.2);
    const sum = home.plus(draw).plus(away);
    expect(sum.toDecimalPlaces(4).toNumber()).toBeCloseTo(1, 3);
  });

  it('favors the side with higher expected goals', () => {
    const { home } = poissonProba(2.0, 0.8);
    expect(home.toNumber()).toBeGreaterThan(0.5);
  });
});

describe('deriveMarketsFromPoisson', () => {
  it('returns coherent derived market probabilities', () => {
    const oneXTwo = poissonProba(1.6, 1.1);
    const derived = deriveMarketsFromPoisson(1.6, 1.1, oneXTwo);

    expect(derived.over25.plus(derived.under25).toNumber()).toBeCloseTo(1, 6);
    expect(derived.bttsYes.plus(derived.bttsNo).toNumber()).toBeCloseTo(1, 6);
    expect(derived.dc1X.toNumber()).toBeCloseTo(
      oneXTwo.home.plus(oneXTwo.draw).toNumber(),
      8,
    );
    expect(derived.dcX2.toNumber()).toBeCloseTo(
      oneXTwo.draw.plus(oneXTwo.away).toNumber(),
      8,
    );
  });
});

describe('calculateDeterministicScore', () => {
  it('calculates weighted score for known inputs', () => {
    const score = calculateDeterministicScore({
      recentForm: new Decimal('0.8'),
      xg: new Decimal('0.7'),
      domExtPerf: new Decimal('0.6'),
      leagueVolat: new Decimal('0.4'),
    });

    expect(score.toNumber()).toBeCloseTo(0.66, 4);
  });
});

describe('BettingEngineService', () => {
  it('computes 1X2 and derived probabilities together', () => {
    const service = new BettingEngineService();
    const p = service.computeProbabilities(1.4, 1.1);

    expect(p.home.plus(p.draw).plus(p.away).toNumber()).toBeCloseTo(1, 3);
    expect(p.over25.plus(p.under25).toNumber()).toBeCloseTo(1, 6);
    expect(p.bttsYes.plus(p.bttsNo).toNumber()).toBeCloseTo(1, 6);
  });
});
