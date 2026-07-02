import Decimal from 'decimal.js';
import { CALIBRATION_GATE } from './ev.constants';

// Pure model↔market coherence assessment (see CALIBRATION_GATE in
// ev.constants.ts for thresholds and rationale). Inputs are the model's 1X2
// probabilities and the latest 1X2 odds per priority bookmaker; output is a
// serializable alert stored in ModelRun.features.calibration_alert, or null
// when the model is coherent with the market.

export type OneXTwoOutcome = 'HOME' | 'DRAW' | 'AWAY';

export type OneXTwoProbabilities = {
  home: Decimal;
  draw: Decimal;
  away: Decimal;
};

export type BookmakerOneXTwoOdds = {
  bookmaker: string;
  homeOdds: Decimal;
  drawOdds: Decimal;
  awayOdds: Decimal;
};

export type CalibrationAlertReason = 'extreme_divergence' | 'favorite_flip';

export type CalibrationAlert = {
  reasons: CalibrationAlertReason[];
  modelFavorite: OneXTwoOutcome;
  marketFavorite: OneXTwoOutcome;
  // Model probability vs median implied, both on the model's favorite outcome.
  modelProbability: number;
  medianImplied: number;
  divergence: number;
  bookmakerCount: number;
};

// Median implied 1X2 probabilities across bookmakers, as raw 1/odds (the
// bookmaker margin is deliberately NOT removed): this keeps the divergence
// measure identical to the backtested AVOID edge (probability − 1/odds), so
// MAX_DIVERGENCE aligns with AVOID_CONFIG.maxEdge. Normalizing the overround
// away would deflate favorites' implied and re-flag fixtures AVOID
// intentionally tolerates (e.g. Kongsvinger 0.90 vs 0.617: edge 0.28 < 0.30).
export function computeMedianImpliedProbabilities(
  books: BookmakerOneXTwoOdds[],
): OneXTwoProbabilities | null {
  const perBook = books.flatMap((b) => {
    if (
      b.homeOdds.lessThanOrEqualTo(1) ||
      b.drawOdds.lessThanOrEqualTo(1) ||
      b.awayOdds.lessThanOrEqualTo(1)
    ) {
      return [];
    }
    return [
      {
        home: new Decimal(1).div(b.homeOdds),
        draw: new Decimal(1).div(b.drawOdds),
        away: new Decimal(1).div(b.awayOdds),
      },
    ];
  });

  if (perBook.length === 0) return null;

  return {
    home: median(perBook.map((p) => p.home)),
    draw: median(perBook.map((p) => p.draw)),
    away: median(perBook.map((p) => p.away)),
  };
}

export function assessMarketCoherence(input: {
  modelProbabilities: OneXTwoProbabilities;
  books: BookmakerOneXTwoOdds[];
}): CalibrationAlert | null {
  if (!CALIBRATION_GATE.ENABLED) return null;
  if (input.books.length < CALIBRATION_GATE.MIN_BOOKMAKERS) return null;

  const medianImplied = computeMedianImpliedProbabilities(input.books);
  if (medianImplied === null) return null;

  const modelFavorite = argmaxOutcome(input.modelProbabilities);
  const marketFavorite = argmaxOutcome(medianImplied);

  const modelProbability = input.modelProbabilities[toKey(modelFavorite)];
  const impliedAtModelFavorite = medianImplied[toKey(modelFavorite)];
  const divergence = modelProbability.minus(impliedAtModelFavorite).abs();

  const reasons: CalibrationAlertReason[] = [];

  if (divergence.greaterThanOrEqualTo(CALIBRATION_GATE.MAX_DIVERGENCE)) {
    reasons.push('extreme_divergence');
  }

  if (
    modelFavorite !== marketFavorite &&
    modelProbability
      .minus(impliedAtModelFavorite)
      .greaterThanOrEqualTo(CALIBRATION_GATE.FAVORITE_FLIP_MIN_GAP)
  ) {
    reasons.push('favorite_flip');
  }

  if (reasons.length === 0) return null;

  return {
    reasons,
    modelFavorite,
    marketFavorite,
    modelProbability: modelProbability.toNumber(),
    medianImplied: impliedAtModelFavorite.toNumber(),
    divergence: divergence.toNumber(),
    bookmakerCount: input.books.length,
  };
}

function argmaxOutcome(probs: OneXTwoProbabilities): OneXTwoOutcome {
  if (
    probs.home.greaterThanOrEqualTo(probs.draw) &&
    probs.home.greaterThanOrEqualTo(probs.away)
  ) {
    return 'HOME';
  }
  return probs.away.greaterThanOrEqualTo(probs.draw) ? 'AWAY' : 'DRAW';
}

function toKey(outcome: OneXTwoOutcome): keyof OneXTwoProbabilities {
  if (outcome === 'HOME') return 'home';
  return outcome === 'AWAY' ? 'away' : 'draw';
}

function median(values: Decimal[]): Decimal {
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted[mid];
  const beforeMid = sorted[mid - 1];
  if (midValue === undefined) return new Decimal(0);
  if (sorted.length % 2 === 1 || beforeMid === undefined) return midValue;
  return midValue.plus(beforeMid).div(2);
}
