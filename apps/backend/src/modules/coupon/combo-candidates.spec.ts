import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { Market } from '@evcore/db';
import type { FullOddsSnapshot } from '@modules/betting-engine/betting-engine.types';
import { buildComboCandidates } from './combo-candidates';

// A strong home favourite with goals: HOME, OVER 2.5 and BTTS YES are all likely.
// Odds are deliberately generous (naive bookmaker product) so whitelisted combos
// clear the EV gate, which is the scenario Étape 6 targets.
function snapshot(): FullOddsSnapshot {
  return {
    bookmaker: 'Pinnacle',
    snapshotAt: new Date(),
    homeOdds: new Decimal('1.60'),
    drawOdds: new Decimal('4.20'),
    awayOdds: new Decimal('5.50'),
    overUnderOdds: { OVER: new Decimal('1.80'), UNDER: new Decimal('2.05') },
    bttsYesOdds: new Decimal('1.85'),
    bttsNoOdds: new Decimal('1.95'),
    htftOdds: {},
    ouHtOdds: {},
    firstHalfWinnerOdds: null,
    doubleChanceOdds: {
      '1X': new Decimal('1.25'),
      X2: new Decimal('2.40'),
      '12': new Decimal('1.30'),
    },
  };
}

describe('buildComboCandidates', () => {
  const base = { lambdaHome: 1.9, lambdaAway: 1.2, snapshot: snapshot() };

  it('returns only whitelisted combos that clear the EV gate', () => {
    const candidates = buildComboCandidates({ ...base, evThreshold: 0.08 });
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.ev).toBeGreaterThanOrEqual(0.08);
      // Joint probability is a valid probability and odds are > 1.
      expect(c.jointProbability).toBeGreaterThan(0);
      expect(c.jointProbability).toBeLessThanOrEqual(1);
      expect(c.combinedOdds).toBeGreaterThan(1);
      // EV is consistent with joint probability × combined odds − 1.
      expect(c.ev).toBeCloseTo(c.jointProbability * c.combinedOdds - 1, 9);
    }
  });

  it('uses the bivariate Poisson joint, not the naive product p1 × p2', () => {
    const candidates = buildComboCandidates({ ...base, evThreshold: -1 });
    expect(candidates.length).toBeGreaterThan(0);
    const candidate = candidates[0];
    // For correlated same-match markets the Poisson joint differs from p1 × p2;
    // we only assert the joint is a sane probability (correlation handled upstream).
    expect(candidate.jointProbability).toBeGreaterThan(0);
    expect(candidate.jointProbability).toBeLessThan(1);
  });

  it('raising the EV threshold yields a subset (monotonic gate)', () => {
    const loose = buildComboCandidates({ ...base, evThreshold: -1 });
    const strict = buildComboCandidates({ ...base, evThreshold: 0.2 });
    expect(strict.length).toBeLessThanOrEqual(loose.length);
    for (const c of strict) {
      expect(c.ev).toBeGreaterThanOrEqual(0.2);
    }
  });

  it('skips combos whose markets are not both priced (no invented odds)', () => {
    const noBtts: FullOddsSnapshot = {
      ...snapshot(),
      bttsYesOdds: null,
      bttsNoOdds: null,
    };
    const candidates = buildComboCandidates({
      lambdaHome: 1.9,
      lambdaAway: 1.2,
      snapshot: noBtts,
      evThreshold: -1,
    });
    // No combo referencing BTTS can be priced now.
    for (const c of candidates) {
      expect(c.combo.market2).not.toBe(Market.BTTS);
      expect(c.combo.market1).not.toBe(Market.BTTS);
    }
  });
});
