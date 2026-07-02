import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  assessMarketCoherence,
  computeMedianImpliedProbabilities,
  type BookmakerOneXTwoOdds,
} from './market-coherence';

function book(
  name: string,
  odds: [number, number, number],
): BookmakerOneXTwoOdds {
  return {
    bookmaker: name,
    homeOdds: new Decimal(odds[0]),
    drawOdds: new Decimal(odds[1]),
    awayOdds: new Decimal(odds[2]),
  };
}

function probs(home: number, draw: number, away: number) {
  return {
    home: new Decimal(home),
    draw: new Decimal(draw),
    away: new Decimal(away),
  };
}

describe('computeMedianImpliedProbabilities', () => {
  it('takes the per-outcome median of raw 1/odds (margin kept, AVOID-consistent)', () => {
    const result = computeMedianImpliedProbabilities([
      book('A', [2.0, 3.5, 4.0]),
      book('B', [2.1, 3.4, 3.9]),
      book('C', [1.9, 3.6, 4.2]),
    ]);
    expect(result).not.toBeNull();
    // Home: median of 1/2, 1/2.1, 1/1.9 → 0.5.
    expect(result!.home.toNumber()).toBeCloseTo(0.5, 6);
    // Draw: median of 1/3.5, 1/3.4, 1/3.6 → 1/3.5.
    expect(result!.draw.toNumber()).toBeCloseTo(1 / 3.5, 6);
  });

  it('ignores books with odds ≤ 1 and returns null when none are usable', () => {
    expect(computeMedianImpliedProbabilities([book('A', [1, 3.5, 4])])).toBe(
      null,
    );
  });
});

describe('assessMarketCoherence', () => {
  const marketArgentina = [
    // Argentina–Cape Verde (2026-07-03): market has home ~87% implied.
    book('Pinnacle', [1.16, 6.8, 17]),
    book('Bet365', [1.14, 8.0, 19]),
    book('WilliamHill', [1.15, 7.0, 19]),
  ];

  it('flags the Argentina case: corrupted λ inverted the model favorite', () => {
    // Model with λ 0.41/0.56 → Cape Verde slight favorite, huge draw mass.
    const alert = assessMarketCoherence({
      modelProbabilities: probs(0.24, 0.38, 0.38),
      books: marketArgentina,
    });

    expect(alert).not.toBeNull();
    expect(alert!.reasons).toContain('extreme_divergence');
    expect(alert!.marketFavorite).toBe('HOME');
    expect(alert!.modelFavorite).not.toBe('HOME');
    expect(alert!.bookmakerCount).toBe(3);
  });

  it('stays silent when model and market agree', () => {
    const alert = assessMarketCoherence({
      modelProbabilities: probs(0.8, 0.13, 0.07),
      books: marketArgentina,
    });
    expect(alert).toBeNull();
  });

  it('flags favorite_flip when the disagreement gap passes the threshold', () => {
    const alert = assessMarketCoherence({
      // Model sees AWAY at 55% where market has it as clear outsider.
      modelProbabilities: probs(0.25, 0.2, 0.55),
      books: [book('A', [1.5, 4.2, 6.5]), book('B', [1.55, 4.0, 6.0])],
    });
    expect(alert).not.toBeNull();
    expect(alert!.reasons).toContain('favorite_flip');
    expect(alert!.modelFavorite).toBe('AWAY');
    expect(alert!.marketFavorite).toBe('HOME');
  });

  it('does not alert below MIN_BOOKMAKERS (median not meaningful)', () => {
    const alert = assessMarketCoherence({
      modelProbabilities: probs(0.24, 0.38, 0.38),
      books: [marketArgentina[0]!],
    });
    expect(alert).toBeNull();
  });

  it('tolerates moderate divergence on the same favorite (no alert)', () => {
    // Kongsvinger case: model 90% vs implied ~62% on HOME — divergence 0.28
    // stays under MAX_DIVERGENCE (0.30) and the favorite matches.
    const alert = assessMarketCoherence({
      modelProbabilities: probs(0.9, 0.06, 0.04),
      books: [book('A', [1.62, 4.33, 4.1]), book('B', [1.6, 4.4, 4.2])],
    });
    expect(alert).toBeNull();
  });
});
