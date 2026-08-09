import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  CouponComposerService,
  calibratedLegProbability,
  calibrateLegProbability,
  clearsValueEdgeFloor,
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
  dayBucket?: string;
}): ScoredPick {
  return {
    fixtureId: overrides.fixtureId,
    homeTeam: 'Home',
    awayTeam: 'Away',
    competition: overrides.competition ?? 'World Cup',
    country: 'World',
    scheduledAt: new Date('2026-06-12T18:00:00.000Z'),
    dayBucket: overrides.dayBucket ?? '2026-06-12',
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
    dataCoverage: null,
    shadowConflict: null,
    offensiveBalance: null,
    priorAnalysisCount: 0,
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

  it('falls back to the blend for an untracked market (e.g. DOUBLE_CHANCE)', () => {
    const leg = { probability: 0.8, calibratedHitRate: 0.6 };
    const value = calibrateLegProbability(
      { ...leg, market: 'DOUBLE_CHANCE' },
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

describe('clearsValueEdgeFloor', () => {
  const getMinEdge = () => new Decimal('0.10');

  it('never gates non-VALUE canals', () => {
    const leg = {
      canal: 'SAFE',
      calibratedProbability: null,
      oddsSnapshot: null,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(true);
  });

  it('rejects a VALUE leg without a calibrated probability or odds', () => {
    const leg = {
      canal: 'VALUE',
      calibratedProbability: null,
      oddsSnapshot: 2.5,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(false);
  });

  it('rejects a VALUE leg below the edge floor', () => {
    const leg = {
      canal: 'VALUE',
      calibratedProbability: 0.55, // 1/odds = 0.5 → edge = 0.05 < 0.10
      oddsSnapshot: 2.0,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(false);
  });

  it('accepts a VALUE leg at or above the edge floor', () => {
    const leg = {
      canal: 'VALUE',
      calibratedProbability: 0.65, // 1/odds = 0.5 → edge = 0.15 ≥ 0.10
      oddsSnapshot: 2.0,
      featureSnapshot: {},
    };
    expect(clearsValueEdgeFloor(leg, getMinEdge)).toBe(true);
  });

  it('uses the per-league override (e.g. a suspended league) over the default floor', () => {
    const leg = {
      canal: 'VALUE',
      calibratedProbability: 0.65,
      oddsSnapshot: 2.0,
      featureSnapshot: { competitionCode: 'FRI' },
    };
    const getSuspended = (code: string | null) =>
      code === 'FRI' ? new Decimal('1') : undefined;
    expect(clearsValueEdgeFloor(leg, getSuspended)).toBe(false);
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

  it('excludes a VALUE leg below the edge floor from every composed coupon', () => {
    const weakValuePick = makePick({
      fixtureId: 'f4',
      canal: 'VALUE',
      market: 'DOUBLE_CHANCE',
      probability: 0.55,
      calibratedHitRate: 0.55,
      calibratedProbability: 0.55, // 1/odds = 0.5 → edge = 0.05 < VALUE_MIN_EDGE (0.10)
      oddsSnapshot: 2.0,
      signalScore: 0.5,
    });

    const withoutWeakLeg = service.compose([safePick, bttsStrong, bttsWeak]);
    const withWeakLeg = service.compose([
      safePick,
      bttsStrong,
      bttsWeak,
      weakValuePick,
    ]);

    expect(
      withWeakLeg.some((c) => c.legs.some((l) => l.fixtureId === 'f4')),
    ).toBe(false);
    expect(withWeakLeg).toEqual(withoutWeakLeg);
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

describe('CouponComposerService.compose — longshot (composeGreedy)', () => {
  const service = new CouponComposerService();

  // 12 legs, odds 1.7 each: 1.7^8 ≈ 69.8 (inside [50,70]), 1.7^9 ≈ 118.7 (out
  // of band) — the greedy walk should settle around 8 legs. Spread across 3
  // days (4 legs/day) and 6 competitions (2 legs/competition, at the
  // max-2-per-competition anti-correlation cap) with a distinct market per
  // leg so the 1-per-(canal,market) cap never binds.
  const days = ['2026-08-07', '2026-08-08', '2026-08-09'];
  const competitions = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  const canals: Canal[] = ['VALUE', 'SAFE', 'BTTS', 'DRAW', 'DOMINANT'];
  const longshotLegs = Array.from({ length: 12 }, (_, i) =>
    makePick({
      fixtureId: `ls${i}`,
      canal: canals[i % canals.length],
      market: `MARKET_${i}`,
      probability: 0.65,
      calibratedHitRate: 0.65,
      oddsSnapshot: 1.7,
      signalScore: 0.9 - i * 0.01,
      competition: competitions[i % competitions.length],
      dayBucket: days[i % days.length],
    }),
  );

  it('routes to composeGreedy above EXHAUSTIVE_LEG_THRESHOLD and hits the target odds band', () => {
    const { LONGSHOT_WEEKEND } = COUPON_PROFILES;
    const coupons = service.compose(longshotLegs, LONGSHOT_WEEKEND);
    expect(coupons.length).toBeGreaterThan(0);
    for (const coupon of coupons) {
      expect(coupon.legs.length).toBeGreaterThanOrEqual(
        LONGSHOT_WEEKEND.minLegs,
      );
      expect(coupon.legs.length).toBeLessThanOrEqual(LONGSHOT_WEEKEND.maxLegs);
      expect(coupon.combinedOdds).toBeGreaterThanOrEqual(
        LONGSHOT_WEEKEND.minCombinedOdds,
      );
      expect(coupon.combinedOdds).toBeLessThanOrEqual(
        LONGSHOT_WEEKEND.maxCombinedOdds,
      );
      // No two legs share a fixture, and no competition contributes more
      // than 2 legs — same anti-correlation rules as the exhaustive path.
      const fixtureIds = coupon.legs.map((l) => l.fixtureId);
      expect(new Set(fixtureIds).size).toBe(fixtureIds.length);
      const perCompetition = new Map<string, number>();
      for (const leg of coupon.legs) {
        perCompetition.set(
          leg.competition,
          (perCompetition.get(leg.competition) ?? 0) + 1,
        );
      }
      for (const count of perCompetition.values()) {
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });

  it('caps legs per day at maxLegsPerDay', () => {
    const { LONGSHOT_WEEKEND } = COUPON_PROFILES;
    const coupons = service.compose(longshotLegs, LONGSHOT_WEEKEND);
    expect(coupons.length).toBeGreaterThan(0);
    for (const coupon of coupons) {
      const perDay = new Map<string, number>();
      for (const leg of coupon.legs) {
        perDay.set(leg.dayBucket, (perDay.get(leg.dayBucket) ?? 0) + 1);
      }
      for (const count of perDay.values()) {
        expect(count).toBeLessThanOrEqual(LONGSHOT_WEEKEND.maxLegsPerDay!);
      }
    }
  });

  it('a tight maxLegsPerDay forces the walk to spread across more days', () => {
    const tightProfile = {
      ...COUPON_PROFILES.LONGSHOT_WEEKEND,
      maxLegsPerDay: 2,
      minLegs: 2,
      minCombinedOdds: 1.0,
      minJointProbability: 0,
      minCouponEV: -1,
    };
    const coupons = service.compose(longshotLegs, tightProfile);
    expect(coupons.length).toBeGreaterThan(0);
    for (const coupon of coupons) {
      const perDay = new Map<string, number>();
      for (const leg of coupon.legs) {
        perDay.set(leg.dayBucket, (perDay.get(leg.dayBucket) ?? 0) + 1);
      }
      for (const count of perDay.values()) {
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('CouponComposerService.compose — cross-coupon diversity', () => {
  const service = new CouponComposerService();

  // A dominant "star" leg (high probability) paired with 4 weaker partners —
  // every star+partner pair beats every partner+partner pair on EV, so a
  // naive top-3-by-EV would return star+p1, star+p2, star+p3: the star leg
  // in all 3 coupons, exactly the "répétition absurde" this fix targets.
  // Partner+partner pairs still clear the profile's viability bounds on
  // their own, so there ARE genuine star-free alternatives available.
  const star = makePick({
    fixtureId: 'star',
    canal: 'SAFE',
    market: 'OVER_UNDER',
    probability: 0.85,
    calibratedHitRate: 0.85,
    oddsSnapshot: 1.58,
    signalScore: 0.9,
    competition: 'Star League',
  });
  const partners = ['p1', 'p2', 'p3', 'p4'].map((id, i) =>
    makePick({
      fixtureId: id,
      canal: 'DOMINANT',
      market: `ONE_X_TWO_${id}`, // distinct per leg — the "1/(canal,market)" anti-correlation cap must not be what stops partner+partner pairs from forming
      probability: 0.7,
      calibratedHitRate: 0.7,
      oddsSnapshot: 1.58,
      signalScore: 0.8 - i * 0.01,
      competition: `Partner League ${id}`,
    }),
  );

  it('does not let one dominant leg ride into every returned coupon', () => {
    const coupons = service.compose([star, ...partners], COUPON_PROFILES.SAFE);
    expect(coupons).toHaveLength(3);
    const withoutStar = coupons.filter(
      (c) => !c.legs.some((l) => l.fixtureId === 'star'),
    );
    expect(withoutStar.length).toBeGreaterThan(0);
  });

  it('still returns the single best (highest-EV) coupon first', () => {
    const coupons = service.compose([star, ...partners], COUPON_PROFILES.SAFE);
    expect(coupons[0]?.legs.some((l) => l.fixtureId === 'star')).toBe(true);
    expect(coupons[0]?.rank).toBe(1);
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
