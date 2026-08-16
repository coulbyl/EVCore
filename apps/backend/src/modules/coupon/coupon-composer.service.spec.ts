import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  CouponComposerService,
  calibratedLegProbability,
  calibrateLegProbability,
  calibrateJointProbability,
  clearsMinLegProbability,
  clearsValueEdgeFloor,
  comparePicksBySignalThenProbability,
  depthRank,
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
  shadowConflict?: boolean | null;
  offensiveBalance?: 'BALANCED' | 'ASYMMETRIC' | 'STRONGLY_ASYMMETRIC' | null;
  priorAnalysisCount?: number;
  legEV?: number | null;
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
    legEV: overrides.legEV ?? null,
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
    shadowConflict: overrides.shadowConflict ?? null,
    offensiveBalance: overrides.offensiveBalance ?? null,
    priorAnalysisCount: overrides.priorAnalysisCount ?? 0,
    isCorrect: null,
    signalScore: overrides.signalScore,
    pickSource: 'STAKED',
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

describe('clearsMinLegProbability', () => {
  // Regression for the 2026-08-15 replay incident: Kashima OVER_0_5 HT
  // (SAFE, 77.2%, won) paired with Ljungskile-Osters RESULT_BTTS HOME_NO
  // (VALUE, 43.4% — a coin-flip-or-worse, lost) — the VALUE leg already
  // cleared clearsValueEdgeFloor (edge=0.167≥0.10) on the strength of a huge
  // apparent EV (odds 3.75), with nothing checking that the leg itself was
  // more likely to lose than win.
  it('rejects a leg below MIN_LEG_PROBABILITY even with a large edge/EV', () => {
    const leg = {
      calibratedProbability: 0.4339,
      probability: 0.4339,
      calibratedHitRate: 0.4339,
    };
    expect(clearsMinLegProbability(leg)).toBe(false);
  });

  it('accepts a leg at or above MIN_LEG_PROBABILITY', () => {
    const leg = {
      calibratedProbability: 0.772,
      probability: 0.772,
      calibratedHitRate: 0.772,
    };
    expect(clearsMinLegProbability(leg)).toBe(true);
  });

  it('falls back to the legacy blend when calibratedProbability is null', () => {
    const leg = {
      calibratedProbability: null,
      probability: 0.9,
      calibratedHitRate: 0.9,
    };
    expect(clearsMinLegProbability(leg)).toBe(true);
  });
});

describe('CouponComposerService.compose — MIN_LEG_PROBABILITY floor', () => {
  const service = new CouponComposerService();

  it('excludes a below-floor VALUE leg even when its edge/EV clears the VALUE floor', () => {
    const reliable = makePick({
      fixtureId: 'kashima',
      canal: 'SAFE',
      market: 'OVER_UNDER_HT',
      probability: 0.772,
      calibratedHitRate: 0.772,
      calibratedProbability: 0.772,
      oddsSnapshot: 1.42,
      signalScore: 0.8,
    });
    const reliablePartner = makePick({
      fixtureId: 'partner',
      canal: 'SAFE',
      market: 'BTTS',
      probability: 0.75,
      calibratedHitRate: 0.75,
      calibratedProbability: 0.75,
      oddsSnapshot: 1.4,
      signalScore: 0.79,
    });
    const coinFlip = makePick({
      fixtureId: 'ljungskile',
      canal: 'VALUE',
      market: 'RESULT_BTTS',
      probability: 0.4339,
      calibratedHitRate: 0.4339,
      calibratedProbability: 0.4339, // edge = 0.4339 - 1/3.75 = 0.167 ≥ VALUE_MIN_EDGE
      oddsSnapshot: 3.75,
      signalScore: 0.75,
    });

    const coupons = service.compose([reliable, reliablePartner, coinFlip]);
    expect(coupons.length).toBeGreaterThan(0);
    expect(
      coupons.some((c) => c.legs.some((l) => l.fixtureId === 'ljungskile')),
    ).toBe(false);
  });
});

describe('depthRank', () => {
  it('ranks BALANCED offensiveBalance above unknown above ASYMMETRIC above STRONGLY_ASYMMETRIC', () => {
    const base = { shadowConflict: null, priorAnalysisCount: 0 };
    const balanced = depthRank({ ...base, offensiveBalance: 'BALANCED' });
    const unknown = depthRank({ ...base, offensiveBalance: null });
    const asymmetric = depthRank({ ...base, offensiveBalance: 'ASYMMETRIC' });
    const stronglyAsymmetric = depthRank({
      ...base,
      offensiveBalance: 'STRONGLY_ASYMMETRIC',
    });
    expect(balanced).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(asymmetric);
    expect(asymmetric).toBeGreaterThan(stronglyAsymmetric);
  });

  it('ranks no shadow conflict above unknown above conflict', () => {
    const base = { offensiveBalance: null, priorAnalysisCount: 0 };
    const noConflict = depthRank({ ...base, shadowConflict: false });
    const unknown = depthRank({ ...base, shadowConflict: null });
    const conflict = depthRank({ ...base, shadowConflict: true });
    expect(noConflict).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(conflict);
  });

  it('prefers a higher priorAnalysisCount as a minor tie-break', () => {
    const base = { offensiveBalance: null, shadowConflict: null };
    const more = depthRank({ ...base, priorAnalysisCount: 5 });
    const fewer = depthRank({ ...base, priorAnalysisCount: 0 });
    expect(more).toBeGreaterThan(fewer);
    // Capped — priorAnalysisCount alone must never outweigh offensiveBalance
    // or shadowConflict, only break ties within the same tier.
    const manyAnalysesButAsymmetric = depthRank({
      offensiveBalance: 'ASYMMETRIC',
      shadowConflict: null,
      priorAnalysisCount: 100,
    });
    const noAnalysesButBalanced = depthRank({
      offensiveBalance: 'BALANCED',
      shadowConflict: null,
      priorAnalysisCount: 0,
    });
    expect(noAnalysesButBalanced).toBeGreaterThan(manyAnalysesButAsymmetric);
  });
});

describe('CouponComposerService.compose — anchor/value pool mix', () => {
  const service = new CouponComposerService();

  it('keeps both anchor and value legs in the pool instead of one dominant canal crowding it out', () => {
    // 6 SAFE anchors (high probability, same canal — would flat-out dominate
    // a pool sorted only by signalScore, since SAFE's CANAL_BASE_WEIGHT is
    // the highest) across 6 different competitions, plus a genuinely good
    // VALUE leg (moderate probability, real edge) on a 7th competition —
    // the flat sort would never even consider whether VALUE has anything
    // worth including.
    const anchors = Array.from({ length: 6 }, (_, i) =>
      makePick({
        fixtureId: `anchor${i}`,
        canal: 'SAFE',
        market: `MARKET_A${i}`,
        probability: 0.85,
        calibratedHitRate: 0.85,
        oddsSnapshot: 1.3,
        signalScore: 0.9,
        competition: `Anchor League ${i}`,
      }),
    );
    const valueLeg = makePick({
      fixtureId: 'value1',
      canal: 'VALUE',
      market: 'ONE_X_TWO',
      probability: 0.65,
      calibratedHitRate: 0.65,
      calibratedProbability: 0.65,
      oddsSnapshot: 2.2,
      signalScore: 0.5,
      competition: 'Value League',
    });

    const coupons = service.compose([...anchors, valueLeg], {
      minLegs: 2,
      maxLegs: 5,
      minCombinedOdds: 1.0,
      maxCombinedOdds: 20.0,
      minJointProbability: 0,
      minCouponEV: -1,
    });
    expect(
      coupons.some((c) => c.legs.some((l) => l.fixtureId === 'value1')),
    ).toBe(true);
  });

  it('caps candidates per competition in the pool (per mode)', () => {
    // 4 anchor-grade legs all in the SAME competition — the pool should
    // only ever keep MAX_POOL_PER_COMPETITION (2) of them.
    const sameLeague = Array.from({ length: 4 }, (_, i) =>
      makePick({
        fixtureId: `same${i}`,
        canal: 'SAFE',
        market: `MARKET_S${i}`,
        probability: 0.8,
        calibratedHitRate: 0.8,
        oddsSnapshot: 1.35,
        signalScore: 0.9 - i * 0.01,
        competition: 'Crowded League',
      }),
    );

    const coupons = service.compose(sameLeague, {
      minLegs: 2,
      maxLegs: 4,
      minCombinedOdds: 1.0,
      maxCombinedOdds: 10.0,
      minJointProbability: 0,
      minCouponEV: -1,
    });
    const usedFixtures = new Set(
      coupons.flatMap((c) => c.legs.map((l) => l.fixtureId)),
    );
    expect(usedFixtures.size).toBeLessThanOrEqual(2);
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

  // Probabilities/odds raised vs. the pre-2026-08-15 fixtures — the
  // jointProbability correction (calibrateJointProbability, ~0.4545×) means
  // combos need noticeably stronger raw numbers to still clear
  // DEFAULT_COUPON_PROFILE's minJointProbability/minCouponEV floors.
  const safePick = makePick({
    fixtureId: 'f1',
    canal: 'SAFE',
    market: 'OVER_UNDER',
    probability: 0.95,
    calibratedHitRate: 0.9,
    oddsSnapshot: 1.35,
    signalScore: 0.7,
  });
  const bttsStrong = makePick({
    fixtureId: 'f2',
    canal: 'BTTS',
    market: 'BTTS',
    probability: 0.85,
    calibratedHitRate: 0.85,
    oddsSnapshot: 3.0,
    signalScore: 0.65,
  });
  const bttsWeak = makePick({
    fixtureId: 'f3',
    canal: 'BTTS',
    market: 'BTTS',
    probability: 0.7,
    calibratedHitRate: 0.85,
    oddsSnapshot: 4.4,
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
    // safePick+bttsStrong and safePick+bttsWeak share the "safePick" leg, so
    // the strict no-shared-leg diversity rule (selectDiverseCoupons) would
    // only ever publish one of them from a single compose() call together —
    // composed independently here since the point of this test is that each
    // pick-specific mix computes its OWN joint probability, not that both
    // publish simultaneously (a separate concern, covered by the
    // cross-coupon-diversity describe block below).
    const strongCoupons = service.compose([safePick, bttsStrong]);
    const weakCoupons = service.compose([safePick, bttsWeak]);
    expect(strongCoupons).toHaveLength(1);
    expect(weakCoupons).toHaveLength(1);

    const rawStrong = strongCoupons[0].rawJointProbability;
    const rawWeak = weakCoupons[0].rawJointProbability;
    expect(rawStrong).not.toBeCloseTo(rawWeak, 10);

    const expectedStrong = calibrateJointProbability(
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsStrong),
    );
    const expectedWeak = calibrateJointProbability(
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsWeak),
    );
    expect(strongCoupons[0].jointProbability).toBeCloseTo(expectedStrong, 10);
    expect(weakCoupons[0].jointProbability).toBeCloseTo(expectedWeak, 10);
  });

  it('sets couponEV = P_coupon × Odd_coupon − 1 from real odds', () => {
    const coupons = service.compose([safePick, bttsStrong]);
    expect(coupons).toHaveLength(1);
    const c = coupons[0];
    expect(c.couponEV).toBeCloseTo(c.jointProbability * c.combinedOdds - 1, 10);
  });

  it('ranks coupons by descending couponEV, not joint probability', () => {
    // A second, fixture-disjoint clone of safePick — otherwise both combos
    // would share the "safePick" leg and the strict no-shared-leg diversity
    // rule would only ever publish one of them (a separate concern, see
    // "cross-coupon diversity" below), leaving nothing to rank against.
    // Distinct `competition` on all 4 legs — they're all anchor-grade
    // (legProbability ≥ ANCHOR_MIN_PROBABILITY), and MAX_POOL_PER_COMPETITION
    // would otherwise cap the (default) shared "World Cup" competition to 2,
    // dropping one of these legs from the pool before compose() even runs.
    const safePick2 = makePick({
      fixtureId: 'f1b',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: safePick.probability,
      calibratedHitRate: safePick.calibratedHitRate,
      oddsSnapshot: safePick.oddsSnapshot,
      signalScore: safePick.signalScore,
      competition: 'League D',
    });
    const coupons = service.compose([
      { ...safePick, competition: 'League A' },
      { ...bttsStrong, competition: 'League B' },
      safePick2,
      { ...bttsWeak, competition: 'League C' },
    ]);
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
  // high joint probability). Probabilities pushed near-certain (0.999) and
  // odds raised toward the top of SAFE's combined-odds band — the
  // jointProbability correction (~0.4545×, see JOINT_PROBABILITY_CORRELATION_
  // FACTOR) caps any coupon's corrected joint probability at ~0.4545
  // regardless of leg count, barely above SAFE.minJointProbability=0.45; only
  // near-certain legs clear it at all, and only combined odds near the top of
  // the [1.6, 2.5] band keep couponEV positive at that low a joint probability.
  const shortLegs = [
    makePick({
      fixtureId: 's1',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: 0.999,
      calibratedHitRate: 0.999,
      oddsSnapshot: 1.565,
      signalScore: 0.72,
    }),
    makePick({
      fixtureId: 's2',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.999,
      calibratedHitRate: 0.999,
      oddsSnapshot: 1.565,
      signalScore: 0.71,
    }),
  ];

  // Long-odds, moderate-probability legs → fit the AGGRESSIVE band (high combined
  // odds, ≥ 3 legs). Probability/odds raised vs. the pre-jointProbability-
  // correction fixtures so couponEV clears minCouponEV=0.15 post-correction
  // (still comfortably below SAFE.maxCombinedOdds so the "SAFE rejects
  // long-odds coupons" test keeps its combinedOdds well above SAFE's cap).
  const longLegs = [
    makePick({
      fixtureId: 'l1',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: 0.75,
      calibratedHitRate: 0.72,
      oddsSnapshot: 2.0,
      signalScore: 0.66,
      competition: 'League A',
    }),
    makePick({
      fixtureId: 'l2',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.75,
      calibratedHitRate: 0.72,
      oddsSnapshot: 2.0,
      signalScore: 0.65,
      competition: 'League B',
    }),
    makePick({
      fixtureId: 'l3',
      canal: 'BTTS',
      market: 'BTTS',
      probability: 0.75,
      calibratedHitRate: 0.72,
      oddsSnapshot: 2.0,
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
  // leg so the 1-per-(canal,market) cap never binds. Probability raised to
  // 0.72 (was 0.65) vs. the pre-jointProbability-correction fixtures — at 8
  // legs the correction (~0.4545×) otherwise pushes couponEV below
  // LONGSHOT_WEEKEND/MIDWEEK's minCouponEV=0.2.
  const days = ['2026-08-07', '2026-08-08', '2026-08-09'];
  const competitions = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  const canals: Canal[] = ['VALUE', 'SAFE', 'BTTS', 'DRAW', 'DOMINANT'];
  const longshotLegs = Array.from({ length: 12 }, (_, i) =>
    makePick({
      fixtureId: `ls${i}`,
      canal: canals[i % canals.length],
      market: `MARKET_${i}`,
      probability: 0.72,
      calibratedHitRate: 0.72,
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

  // Permissive bounds, decoupled from any specific profile's backtested
  // thresholds — these tests exercise `selectDiverseCoupons`'s no-shared-leg
  // rule itself, not a profile's business viability numbers (which, post
  // jointProbability correction, would force unrealistically near-certain
  // fixture probabilities just to clear minJointProbability/minCouponEV).
  const DIVERSITY_TEST_PROFILE = {
    minLegs: 2,
    maxLegs: 5,
    minCombinedOdds: 1.0,
    maxCombinedOdds: 20.0,
    minJointProbability: 0,
    minCouponEV: -1,
  };

  // A dominant "star" leg (high probability) paired with 6 weaker partners —
  // every star+partner pair beats every partner+partner pair on EV, so a
  // naive EV-only ranking would return star+p1, star+p2, star+p3, ...: the
  // star leg riding into every published coupon. With 6 partners the pool
  // supports 3 fully leg-disjoint pairs (star+p_i, then two partner-only
  // pairs using the rest) — enough to show the star is confined to at most
  // one coupon while still publishing multiple coupons, not just fewer.
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
  const partners = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) =>
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

  it('confines the dominant leg to at most one published coupon, and none share a leg', () => {
    const coupons = service.compose(
      [star, ...partners],
      DIVERSITY_TEST_PROFILE,
    );
    expect(coupons.length).toBeGreaterThan(1);
    const withStar = coupons.filter((c) =>
      c.legs.some((l) => l.fixtureId === 'star'),
    );
    expect(withStar.length).toBeLessThanOrEqual(1);
    // No two published coupons may share a single leg — the exact rule that
    // caused two ranked coupons to lose together on 2026-08-15 (a shared
    // TEAM_TOTAL_HOME leg at 1/3 overlap, under the old 50% ratio threshold).
    for (let i = 0; i < coupons.length; i++) {
      for (let j = i + 1; j < coupons.length; j++) {
        const keysA = new Set(coupons[i].legs.map((l) => l.fixtureId));
        const overlaps = coupons[j].legs.some((l) => keysA.has(l.fixtureId));
        expect(overlaps).toBe(false);
      }
    }
  });

  it('still returns the single best (highest-EV) coupon first', () => {
    const coupons = service.compose(
      [star, ...partners],
      DIVERSITY_TEST_PROFILE,
    );
    expect(coupons[0]?.legs.some((l) => l.fixtureId === 'star')).toBe(true);
    expect(coupons[0]?.rank).toBe(1);
  });

  // Direct regression for the 2026-08-15 incident: a coupon sharing exactly
  // one leg out of three (ratio 1/3 ≈ 0.33) with an already-selected coupon
  // used to be ACCEPTED (old threshold was ratio ≥ 0.5). It must now be
  // rejected outright, even though a genuinely disjoint alternative exists.
  it('rejects a 3-leg coupon sharing just one leg with an already-selected coupon', () => {
    const shared = makePick({
      fixtureId: 'shared',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      probability: 0.55,
      calibratedHitRate: 0.55,
      oddsSnapshot: 2.0,
      signalScore: 0.9,
      competition: 'League Shared',
    });
    const rest = ['w', 'x', 'y', 'z', 'v', 'u'].map((id, i) =>
      makePick({
        fixtureId: id,
        canal: 'SAFE',
        market: `MARKET_${id}`,
        probability: 0.55,
        calibratedHitRate: 0.55,
        oddsSnapshot: 2.0,
        signalScore: 0.85 - i * 0.01,
        competition: `League ${id}`,
      }),
    );

    const coupons = service.compose([shared, ...rest], DIVERSITY_TEST_PROFILE);
    expect(coupons.length).toBeGreaterThan(1);
    const withShared = coupons.filter((c) =>
      c.legs.some((l) => l.fixtureId === 'shared'),
    );
    expect(withShared.length).toBeLessThanOrEqual(1);
    for (let i = 0; i < coupons.length; i++) {
      for (let j = i + 1; j < coupons.length; j++) {
        const keysA = new Set(coupons[i].legs.map((l) => l.fixtureId));
        const overlaps = coupons[j].legs.some((l) => keysA.has(l.fixtureId));
        expect(overlaps).toBe(false);
      }
    }
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
