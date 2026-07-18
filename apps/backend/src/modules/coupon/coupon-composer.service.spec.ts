import { describe, expect, it } from 'vitest';
import {
  CouponComposerService,
  calibratedLegProbability,
  calibrateLegProbability,
  comparePicksBySignalThenProbability,
  recommendedCouponStakePct,
  LEG_PROBABILITY_MODEL_WEIGHT,
} from './coupon-composer.service';
import { COUPON_PROFILES } from './coupon.constants';
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
  oddsSnapshot: number | null;
  signalScore: number;
  calibratedProbability?: number | null;
  competition?: string;
}): ScoredPick {
  return {
    fixtureId: overrides.fixtureId,
    homeTeam: 'Home',
    awayTeam: 'Away',
    competition: overrides.competition ?? 'World Cup',
    country: 'World',
    scheduledAt: new Date('2026-06-12T18:00:00.000Z'),
    canal: overrides.canal,
    market: overrides.market,
    pick: 'YES',
    probability: overrides.probability,
    calibratedHitRate: overrides.calibratedHitRate,
    calibratedProbability: overrides.calibratedProbability ?? null,
    oddsSnapshot: overrides.oddsSnapshot,
    legEV: null,
    pMarketFair: null,
    bookmakerMargin: null,
    edge: null,
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
    const joints = coupons.map((c) => c.jointProbability).sort();
    expect(joints[0]).not.toBeCloseTo(joints[1], 10);

    const expectedStrong =
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsStrong);
    const expectedWeak =
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsWeak);
    // Both same-canal mixes are present, each with its own joint probability.
    expect(
      coupons.some(
        (c) => Math.abs(c.jointProbability - expectedStrong) < 1e-10,
      ),
    ).toBe(true);
    expect(
      coupons.some((c) => Math.abs(c.jointProbability - expectedWeak) < 1e-10),
    ).toBe(true);
  });

  it('sets couponEV = P_coupon × Odd_coupon − 1 from real odds', () => {
    const coupons = service.compose([safePick, bttsStrong]);
    expect(coupons).toHaveLength(1);
    const c = coupons[0];
    expect(c.couponEV).toBeCloseTo(c.jointProbability * c.combinedOdds - 1, 10);
  });

  it('ranks coupons by descending couponEV, not joint probability', () => {
    const coupons = service.compose([safePick, bttsStrong, bttsWeak]);
    expect(coupons[0].rank).toBe(1);
    expect(coupons[0].couponEV).toBeGreaterThanOrEqual(coupons[1].couponEV);
    // safe+bttsWeak has the higher EV (longer odds) despite a lower joint prob —
    // so the value-driven order is the inverse of the joint-probability order.
    expect(coupons[0].jointProbability).toBeLessThan(
      coupons[1].jointProbability,
    );
  });

  it('excludes legs without real odds (no FALLBACK_ODDS)', () => {
    const noOdds = makePick({
      fixtureId: 'f4',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.8,
      calibratedHitRate: 0.66,
      oddsSnapshot: null,
      signalScore: 0.72,
    });
    const coupons = service.compose([safePick, bttsStrong, noOdds]);
    for (const coupon of coupons) {
      expect(coupon.legs.every((l) => l.oddsSnapshot !== null)).toBe(true);
    }
  });

  it('drops coupons whose EV is below minCouponEV', () => {
    // Two short-odds favourites: high joint prob but negative EV.
    const favA = makePick({
      fixtureId: 'g1',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: 0.8,
      calibratedHitRate: 0.8,
      oddsSnapshot: 1.1,
      signalScore: 0.7,
    });
    const favB = makePick({
      fixtureId: 'g2',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.8,
      calibratedHitRate: 0.8,
      oddsSnapshot: 1.1,
      signalScore: 0.7,
    });
    expect(service.compose([favA, favB])).toHaveLength(0);
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

describe('CouponComposerService.compose — risk profiles', () => {
  const service = new CouponComposerService();

  // Short-odds, high-probability legs → fit the SAFE band (low combined odds,
  // high joint probability).
  const shortLegs = [
    makePick({
      fixtureId: 's1',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: 0.9,
      calibratedHitRate: 0.88,
      oddsSnapshot: 1.3,
      signalScore: 0.72,
    }),
    makePick({
      fixtureId: 's2',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.88,
      calibratedHitRate: 0.86,
      oddsSnapshot: 1.3,
      signalScore: 0.71,
    }),
  ];

  // Long-odds, moderate-probability legs → fit the AGGRESSIVE band (high combined
  // odds, ≥ 3 legs).
  const longLegs = [
    makePick({
      fixtureId: 'l1',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: 0.62,
      calibratedHitRate: 0.6,
      oddsSnapshot: 1.8,
      signalScore: 0.66,
      competition: 'League A',
    }),
    makePick({
      fixtureId: 'l2',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.62,
      calibratedHitRate: 0.6,
      oddsSnapshot: 1.8,
      signalScore: 0.65,
      competition: 'League B',
    }),
    makePick({
      fixtureId: 'l3',
      canal: 'BTTS',
      market: 'BTTS',
      probability: 0.62,
      calibratedHitRate: 0.6,
      oddsSnapshot: 1.8,
      signalScore: 0.64,
      competition: 'League C',
    }),
  ];

  it('SAFE keeps a viable short-odds, high-probability coupon within its bounds', () => {
    const { SAFE } = COUPON_PROFILES;
    const coupons = service.compose(shortLegs, SAFE);
    expect(coupons.length).toBeGreaterThan(0);
    for (const coupon of coupons) {
      expect(coupon.legs.length).toBeGreaterThanOrEqual(SAFE.minLegs);
      expect(coupon.combinedOdds).toBeLessThanOrEqual(SAFE.maxCombinedOdds);
      expect(coupon.combinedOdds).toBeGreaterThanOrEqual(SAFE.minCombinedOdds);
      expect(coupon.jointProbability).toBeGreaterThanOrEqual(
        SAFE.minJointProbability,
      );
      expect(coupon.couponEV).toBeGreaterThanOrEqual(SAFE.minCouponEV);
    }
  });

  it('SAFE rejects long-odds coupons (combined odds above its cap)', () => {
    expect(service.compose(longLegs, COUPON_PROFILES.SAFE)).toHaveLength(0);
  });

  it('AGGRESSIVE requires ≥ 3 legs and high combined odds', () => {
    const { AGGRESSIVE } = COUPON_PROFILES;
    const coupons = service.compose(longLegs, AGGRESSIVE);
    expect(coupons.length).toBeGreaterThan(0);
    for (const coupon of coupons) {
      expect(coupon.legs.length).toBeGreaterThanOrEqual(AGGRESSIVE.minLegs);
      expect(coupon.combinedOdds).toBeGreaterThanOrEqual(
        AGGRESSIVE.minCombinedOdds,
      );
    }
  });

  it('AGGRESSIVE excludes the 2-leg short-odds coupon (below minLegs/minCombinedOdds)', () => {
    expect(service.compose(shortLegs, COUPON_PROFILES.AGGRESSIVE)).toHaveLength(
      0,
    );
  });
});

describe('recommendedCouponStakePct', () => {
  it('returns the flat default stake when Kelly is disabled', () => {
    const stake = recommendedCouponStakePct(
      { jointProbability: 0.5, combinedOdds: 3 },
      false,
    );
    expect(stake).toBeCloseTo(0.01, 10); // DEFAULT_STAKE_PCT
  });

  it('applies fractional Kelly when enabled, capped at the max stake', () => {
    // P=0.5, O=3 → Kelly=(1.5−1)/(3−1)=0.25 → ×0.25=0.0625 → capped at 0.05.
    const stake = recommendedCouponStakePct(
      { jointProbability: 0.5, combinedOdds: 3 },
      true,
    );
    expect(stake).toBeCloseTo(0.05, 10); // KELLY_MAX_STAKE_PCT cap
  });

  it('returns the uncapped quarter-Kelly stake for a smaller edge', () => {
    // P=0.4, O=3 → Kelly=(1.2−1)/(3−1)=0.1 → ×0.25=0.025 (below cap).
    const stake = recommendedCouponStakePct(
      { jointProbability: 0.4, combinedOdds: 3 },
      true,
    );
    expect(stake).toBeCloseTo(0.025, 10);
  });

  it('returns 0 for a non-value coupon (negative Kelly)', () => {
    // P=0.3, O=3 → P×O=0.9 < 1 → Kelly ≤ 0.
    const stake = recommendedCouponStakePct(
      { jointProbability: 0.3, combinedOdds: 3 },
      true,
    );
    expect(stake).toBe(0);
  });
});
