import { describe, expect, it } from 'vitest';
import {
  CouponComposerService,
  calibratedLegProbability,
  calibrateLegProbability,
  comparePicksBySignalThenProbability,
  LEG_PROBABILITY_MODEL_WEIGHT,
} from './coupon-composer.service';
import type {
  Canal,
  MarketCalibration,
  ScoredPick,
} from './signal-window.service';

function makePick(overrides: {
  fixtureId: string;
  canal: Canal;
  market: string;
  probability: number;
  calibratedHitRate: number;
  oddsSnapshot: number;
  signalScore: number;
  calibratedProbability?: number | null;
}): ScoredPick {
  return {
    fixtureId: overrides.fixtureId,
    homeTeam: 'Home',
    awayTeam: 'Away',
    competition: 'World Cup',
    country: 'World',
    scheduledAt: new Date('2026-06-12T18:00:00.000Z'),
    canal: overrides.canal,
    market: overrides.market,
    pick: 'YES',
    probability: overrides.probability,
    calibratedHitRate: overrides.calibratedHitRate,
    calibratedProbability: overrides.calibratedProbability ?? null,
    oddsSnapshot: overrides.oddsSnapshot,
    lambdaHome: null,
    lambdaAway: null,
    xg: null,
    finalScore: null,
    modelThreshold: null,
    recentForm: null,
    modelProbabilities: {},
    isCorrect: null,
    signalScore: overrides.signalScore,
    featureSnapshot: {},
    homeLogo: null,
    awayLogo: null,
    homeScore: null,
    awayScore: null,
    homeHtScore: null,
    awayHtScore: null,
    betId: null,
    modelRunId: null,
  };
}

describe('calibratedLegProbability', () => {
  it('blends model probability and canal calibrated rate', () => {
    const value = calibratedLegProbability({
      probability: 0.8,
      calibratedHitRate: 0.6,
    });
    expect(value).toBeCloseTo(
      0.8 * LEG_PROBABILITY_MODEL_WEIGHT +
        0.6 * (1 - LEG_PROBABILITY_MODEL_WEIGHT),
      10,
    );
  });
});

describe('calibrateLegProbability', () => {
  const calibration: MarketCalibration = {
    OVER_UNDER: { meanError: 0.1285, betCount: 595 },
    BTTS: { meanError: 0.039, betCount: 341 },
    ONE_X_TWO: { meanError: 0.2, betCount: 10 }, // tracked but below MIN_BET_COUNT
  };

  it('subtracts the measured mean error for a tracked, well-sampled market', () => {
    const value = calibrateLegProbability(
      { probability: 0.66, calibratedHitRate: 0.6, market: 'OVER_UNDER' },
      calibration,
    );
    expect(value).toBeCloseTo(0.66 - 0.1285, 10);
  });

  it('clamps the corrected probability into [capMin, capMax]', () => {
    const value = calibrateLegProbability(
      { probability: 0.05, calibratedHitRate: 0.6, market: 'OVER_UNDER' },
      { OVER_UNDER: { meanError: 0.5, betCount: 200 } },
    );
    expect(value).toBeGreaterThanOrEqual(0.05); // capMin
  });

  it('falls back to the blend for an untracked market (e.g. OVER_UNDER_HT)', () => {
    const leg = { probability: 0.8, calibratedHitRate: 0.6 };
    const value = calibrateLegProbability(
      { ...leg, market: 'OVER_UNDER_HT' },
      calibration,
    );
    expect(value).toBeCloseTo(calibratedLegProbability(leg), 10);
  });

  it('falls back to the blend when the market sample is below MIN_BET_COUNT', () => {
    const leg = { probability: 0.8, calibratedHitRate: 0.6 };
    const value = calibrateLegProbability(
      { ...leg, market: 'ONE_X_TWO' },
      calibration,
    );
    expect(value).toBeCloseTo(calibratedLegProbability(leg), 10);
  });
});

describe('comparePicksBySignalThenProbability', () => {
  it('orders by signalScore first', () => {
    const high = { signalScore: 0.7, probability: 0.5, calibratedHitRate: 0.5 };
    const low = { signalScore: 0.6, probability: 0.9, calibratedHitRate: 0.9 };
    expect(comparePicksBySignalThenProbability(high, low)).toBeLessThan(0);
  });

  it('tie-breaks same-canal picks on blended probability, not insertion order', () => {
    const weak = {
      signalScore: 0.7,
      probability: 0.55,
      calibratedHitRate: 0.69,
    };
    const strong = {
      signalScore: 0.7,
      probability: 0.86,
      calibratedHitRate: 0.69,
    };
    expect([weak, strong].sort(comparePicksBySignalThenProbability)[0]).toBe(
      strong,
    );
  });
});

describe('CouponComposerService.compose', () => {
  const service = new CouponComposerService();

  const safePick = makePick({
    fixtureId: 'f1',
    canal: 'SAFE',
    market: 'OVER_UNDER',
    probability: 0.86,
    calibratedHitRate: 0.69,
    oddsSnapshot: 1.35,
    signalScore: 0.7,
  });
  const bttsStrong = makePick({
    fixtureId: 'f2',
    canal: 'BTTS',
    market: 'BTTS',
    probability: 0.65,
    calibratedHitRate: 0.6875,
    oddsSnapshot: 2.0,
    signalScore: 0.65,
  });
  const bttsWeak = makePick({
    fixtureId: 'f3',
    canal: 'BTTS',
    market: 'BTTS',
    probability: 0.44,
    calibratedHitRate: 0.6875,
    oddsSnapshot: 2.5,
    signalScore: 0.6,
  });

  it('computes pick-specific joint probabilities for the same canal mix', () => {
    const coupons = service.compose([safePick, bttsStrong, bttsWeak]);

    expect(coupons).toHaveLength(2);
    const [first, second] = coupons;
    expect(first.jointProbability).not.toBeCloseTo(second.jointProbability, 10);

    const expectedStrong =
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsStrong);
    const expectedWeak =
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsWeak);
    expect(first.jointProbability).toBeCloseTo(expectedStrong, 10);
    expect(second.jointProbability).toBeCloseTo(expectedWeak, 10);
  });

  it('ranks coupons by descending joint probability', () => {
    const coupons = service.compose([safePick, bttsStrong, bttsWeak]);
    expect(coupons[0].rank).toBe(1);
    expect(coupons[0].jointProbability).toBeGreaterThan(
      coupons[1].jointProbability,
    );
  });

  it('never combines two legs from the same fixture', () => {
    const sameFixture = makePick({
      fixtureId: 'f1',
      canal: 'BTTS',
      market: 'BTTS',
      probability: 0.7,
      calibratedHitRate: 0.6875,
      oddsSnapshot: 1.8,
      signalScore: 0.66,
    });
    const coupons = service.compose([safePick, sameFixture, bttsStrong]);

    for (const coupon of coupons) {
      const fixtures = coupon.legs.map((l) => l.fixtureId);
      expect(new Set(fixtures).size).toBe(fixtures.length);
    }
  });
});
