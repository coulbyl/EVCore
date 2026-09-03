import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  CouponComposerService,
  calibratedLegProbability,
  calibrateLegProbability,
  clearsValueEdgeFloor,
  clearsTeamTotalMaxOdds,
  clearsMaxLegEdge,
  clearsMinLegOdds,
  depthRank,
  LEG_PROBABILITY_MODEL_WEIGHT,
} from './coupon-composer.service';
import {
  COUPON_BOUNDS,
  COUPON_CLASSES,
  COUPON_PARAMS,
  MIN_LEG_ODDS,
  TEAM_TOTAL_MAX_ODDS,
} from './coupon.constants';
import type { Canal, ScoredPick } from './coupon-pool.service';

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
    referenceOdds: overrides.oddsSnapshot,
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
    channelSelectionId: null,
    modelRunId: null,
  };
}

// Construit une jambe à divergence modèle↔marché RÉALISTE : la probabilité est
// dérivée du prix (`1/cote + edge`) au lieu d'être choisie librement.
//
// Les fixtures portaient des edges de 0.17 à 0.52 (p. ex. probabilité 0.85 à
// la cote 3.00 — le modèle annonçant 85% sur ce que le marché price à 33%).
// Mesurée sur 51 860 sélections réglées, cette zone ne réalise que 0.537 de ce
// qu'elle annonce, et MAX_LEG_EDGE la rejette désormais. Tester le composeur
// sur des jambes qu'il ne verra plus jamais revenait à vérifier son
// comportement sur une distribution qui n'existe pas.
function makeEdgePick(overrides: {
  fixtureId: string;
  canal: Canal;
  market: string;
  oddsSnapshot: number;
  signalScore: number;
  edge?: number;
  competition?: string;
  dayBucket?: string;
}): ScoredPick {
  const probability = 1 / overrides.oddsSnapshot + (overrides.edge ?? 0.08);
  return makePick({
    ...overrides,
    probability,
    calibratedHitRate: probability,
    calibratedProbability: probability,
  });
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
  const identity = { a: 1, b: 0, n: 0 };
  // Slope < 1 flattens an over-confident channel toward its base rate — the
  // shape every channel measured on 2026-08-22 actually needs.
  const flattening = { a: 0.4, b: -0.3, n: 5000 };

  const makeWindow = (byChannel: Record<string, typeof identity>) => ({
    channelReliability: byChannel,
    pooledReliability: flattening,
  });

  it('leaves a probability untouched under an identity curve', () => {
    const value = calibrateLegProbability(
      { probability: 0.66, canal: 'DRAW' },
      makeWindow({ DRAW: identity }),
    );
    expect(value).toBeCloseTo(0.66, 10);
  });

  it('applies the leg own channel curve, not another channel curve', () => {
    const window = makeWindow({ DRAW: identity, VALUE: flattening });
    const drawValue = calibrateLegProbability(
      { probability: 0.8, canal: 'DRAW' },
      window,
    );
    const valueValue = calibrateLegProbability(
      { probability: 0.8, canal: 'VALUE' },
      window,
    );
    expect(drawValue).toBeCloseTo(0.8, 10);
    expect(valueValue).toBeLessThan(0.8);
  });

  it('pulls an over-confident probability down and a low one up (flatter slope)', () => {
    const window = makeWindow({ VALUE: flattening });
    expect(
      calibrateLegProbability({ probability: 0.85, canal: 'VALUE' }, window),
    ).toBeLessThan(0.85);
    expect(
      calibrateLegProbability({ probability: 0.15, canal: 'VALUE' }, window),
    ).toBeGreaterThan(0.15);
  });

  it('falls back to the pooled curve for a channel with no fit of its own', () => {
    const window = makeWindow({ DRAW: identity });
    const unknown = calibrateLegProbability(
      { probability: 0.8, canal: 'HALF_TIME_FULL_TIME' },
      window,
    );
    const pooled = calibrateLegProbability(
      { probability: 0.8, canal: 'VALUE' },
      makeWindow({ VALUE: flattening }),
    );
    expect(unknown).toBeCloseTo(pooled, 10);
  });

  it('clamps the calibrated probability into [capMin, capMax]', () => {
    const extreme = { a: 5, b: 6, n: 5000 };
    const value = calibrateLegProbability(
      { probability: 0.99, canal: 'DRAW' },
      makeWindow({ DRAW: extreme }),
    );
    expect(value).toBeLessThanOrEqual(COUPON_PARAMS.capMax);
    expect(value).toBeGreaterThanOrEqual(COUPON_PARAMS.capMin);
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

describe('clearsTeamTotalMaxOdds', () => {
  it('never gates non-TEAM_TOTAL canals, however long the odds', () => {
    const leg = { canal: 'SAFE', oddsSnapshot: 50.0 };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(true);
  });

  it('rejects a TEAM_TOTAL leg without odds', () => {
    const leg = { canal: 'TEAM_TOTAL', oddsSnapshot: null };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(false);
  });

  it('rejects a TEAM_TOTAL leg at or above the odds ceiling (measured: 21.4% real vs 59.4% announced above it)', () => {
    const leg = { canal: 'TEAM_TOTAL', oddsSnapshot: TEAM_TOTAL_MAX_ODDS };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(false);
  });

  it('accepts a TEAM_TOTAL leg below the odds ceiling', () => {
    const leg = { canal: 'TEAM_TOTAL', oddsSnapshot: 1.8 };
    expect(clearsTeamTotalMaxOdds(leg)).toBe(true);
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
    // Canal DOMINANT et non VALUE : VALUE ne fait plus partie du pool
    // (POOL_EXCLUDED_CHANNELS) et son plancher d'edge `clearsValueEdgeFloor`
    // (>= 0.10) est exactement le complémentaire de MAX_LEG_EDGE (<= 0.10).
    const valueLeg = makePick({
      fixtureId: 'value1',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.535,
      calibratedHitRate: 0.535,
      calibratedProbability: 0.535,
      oddsSnapshot: 2.2,
      signalScore: 0.5,
      competition: 'Value League',
    });

    const coupons = service.compose([...anchors, valueLeg], {
      bounds: {
        minLegs: 2,
        maxLegs: 5,
        minCombinedOdds: 1.0,
        maxCombinedOdds: 20.0,
      },
    });
    expect(
      coupons.some((c) => c.legs.some((l) => l.fixtureId === 'value1')),
    ).toBe(true);
  });

  it('caps legs per competition inside a single coupon (anti-correlation)', () => {
    // 10 anchor-grade legs all in the SAME competition. The pool itself no
    // longer caps candidates per competition (buildCandidatePool doc,
    // coupon-composer.service.ts — removed 2026-08-22, it only ever
    // throttled the search without protecting anything the intra-coupon
    // rule below doesn't already cover). What's still enforced is inside a
    // single published coupon: at most 2 legs from the same competition
    // (violatesAntiCorrelation).
    const sameLeague = Array.from({ length: 10 }, (_, i) =>
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
      bounds: {
        minLegs: 2,
        maxLegs: 4,
        minCombinedOdds: 1.0,
        maxCombinedOdds: 10.0,
      },
    });

    for (const coupon of coupons) {
      const fromCrowded = coupon.legs.filter(
        (l) => l.competition === 'Crowded League',
      );
      expect(fromCrowded.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('CouponComposerService.compose', () => {
  const service = new CouponComposerService();

  // Probabilities/odds raised vs. the pre-2026-08-15 fixtures — the
  // Plus de correction au niveau coupon (voir MAX_LEG_EDGE) : la proba jointe
  // combos need noticeably stronger raw numbers to still clear
  // est le produit brut des probas de jambe, sans plancher d'EV ni de proba.
  const safePick = makeEdgePick({
    fixtureId: 'f1',
    canal: 'SAFE',
    market: 'OVER_UNDER',
    oddsSnapshot: 1.35,
    signalScore: 0.7,
  });
  const bttsStrong = makeEdgePick({
    fixtureId: 'f2',
    canal: 'BTTS',
    market: 'BTTS',
    oddsSnapshot: 2.4,
    signalScore: 0.65,
    edge: 0.06,
  });
  const bttsWeak = makeEdgePick({
    fixtureId: 'f3',
    canal: 'BTTS',
    market: 'BTTS',
    oddsSnapshot: 3.6,
    signalScore: 0.6,
    edge: 0.075,
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

  it('excludes a TEAM_TOTAL leg at or above TEAM_TOTAL_MAX_ODDS from every composed coupon', () => {
    const longTeamTotalPick = makePick({
      fixtureId: 'f5',
      canal: 'TEAM_TOTAL',
      market: 'TEAM_TOTAL_HOME',
      probability: 0.45,
      calibratedHitRate: 0.45,
      calibratedProbability: 0.45,
      oddsSnapshot: TEAM_TOTAL_MAX_ODDS,
      signalScore: 0.5,
    });

    const withoutLongLeg = service.compose([safePick, bttsStrong, bttsWeak]);
    const withLongLeg = service.compose([
      safePick,
      bttsStrong,
      bttsWeak,
      longTeamTotalPick,
    ]);

    expect(
      withLongLeg.some((c) => c.legs.some((l) => l.fixtureId === 'f5')),
    ).toBe(false);
    expect(withLongLeg).toEqual(withoutLongLeg);
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

    const expectedStrong =
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsStrong);
    const expectedWeak =
      calibratedLegProbability(safePick) * calibratedLegProbability(bttsWeak);
    expect(strongCoupons[0].jointProbability).toBeCloseTo(expectedStrong, 10);
    expect(weakCoupons[0].jointProbability).toBeCloseTo(expectedWeak, 10);
  });

  it("carries each leg's calibratedProbability into reasoning (regression: reasoning.legs[].calibratedCanalHitRate read a featureSnapshot key nothing has written since the 2026-08-22 sliding-window removal, so it was silently null on every coupon leg)", () => {
    const coupons = service.compose([safePick, bttsStrong]);
    expect(coupons).toHaveLength(1);

    const reasoning = coupons[0].reasoning as {
      legs: { calibratedProbability: number | null }[];
    };
    expect(reasoning.legs).toHaveLength(2);
    for (const leg of reasoning.legs) {
      expect(leg.calibratedProbability).not.toBeNull();
    }
    expect(reasoning.legs[0]?.calibratedProbability).toBeCloseTo(
      safePick.calibratedProbability as number,
      10,
    );
    expect(Object.keys(reasoning.legs[0] as object)).not.toContain(
      'calibratedCanalHitRate',
    );
  });

  it('sets couponEV = P_coupon × Odd_coupon − 1 from real odds', () => {
    const coupons = service.compose([safePick, bttsStrong]);
    expect(coupons).toHaveLength(1);
    const c = coupons[0];
    expect(c.couponEV).toBeCloseTo(c.jointProbability * c.combinedOdds - 1, 10);
  });

  it('publishes the highest-probability legs first, later coupons from what is left', () => {
    // Le classement par EV décroissante a été retiré le 2026-08-22 : il perd
    // contre le tri par probabilité dans 13 des 16 configurations comparées
    // deux à deux (+6.7 points), et sur le test hors échantillon au niveau
    // coupon (−25.94% contre −6.57%). La composition est gloutonne par
    // probabilité, et chaque coupon consomme ses matchs.
    const strong = makeEdgePick({
      fixtureId: 'strong',
      canal: 'SAFE',
      market: 'OVER_UNDER',
      oddsSnapshot: 1.3,
      signalScore: 0.5,
    });
    const strong2 = makeEdgePick({
      fixtureId: 'strong2',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      oddsSnapshot: 1.35,
      signalScore: 0.5,
    });
    const weak = makeEdgePick({
      fixtureId: 'weak',
      canal: 'GOALS',
      market: 'BTTS',
      oddsSnapshot: 3.4,
      signalScore: 0.9, // signalScore élevé : ne doit PAS le faire remonter
    });
    const weak2 = makeEdgePick({
      fixtureId: 'weak2',
      canal: 'DRAW',
      market: 'DOUBLE_CHANCE',
      oddsSnapshot: 3.6,
      signalScore: 0.9,
    });

    const coupons = service.compose([weak, weak2, strong, strong2]);

    expect(coupons).toHaveLength(2);
    expect(coupons[0].legs.map((l) => l.fixtureId).sort()).toEqual([
      'strong',
      'strong2',
    ]);
    expect(coupons[1].legs.map((l) => l.fixtureId).sort()).toEqual([
      'weak',
      'weak2',
    ]);
    expect(coupons[0].jointProbability).toBeGreaterThan(
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
      probability: 0.636,
      calibratedHitRate: 0.636,
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

describe('CouponComposerService.compose — cross-coupon diversity', () => {
  const service = new CouponComposerService();

  // Permissive bounds, decoupled from any specific profile's backtested
  // thresholds — these tests exercise `selectDiverseCoupons`'s no-shared-leg
  // rule itself, not a profile's business viability numbers (which, post
  // jointProbability correction, would force unrealistically near-certain
  // fixture probabilities just to clear minJointProbability/minCouponEV).
  const DIVERSITY_TEST_PROFILE = {
    bounds: {
      minLegs: 2,
      maxLegs: 5,
      minCombinedOdds: 1.0,
      maxCombinedOdds: 20.0,
    },
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
    probability: 0.713,
    calibratedHitRate: 0.713,
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
      probability: 0.58,
      calibratedHitRate: 0.58,
      oddsSnapshot: 2.0,
      signalScore: 0.9,
      competition: 'League Shared',
    });
    const rest = ['w', 'x', 'y', 'z', 'v', 'u'].map((id, i) =>
      makePick({
        fixtureId: id,
        canal: 'SAFE',
        market: `MARKET_${id}`,
        probability: 0.58,
        calibratedHitRate: 0.58,
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

  // Regression 2026-08-16: VALUE and DOMINANT can both independently pick
  // ONE_X_TWO/HOME on the same fixture — the same underlying bet under two
  // different channel labels. Before the fix, sharesAnyLeg compared on a
  // canal-inclusive key, so these two ScoredPicks registered as "different"
  // legs and could ride into two separately-published coupons, both losing
  // together on the same result — the exact correlation the 08-15 fix was
  // meant to close, just entered from the cross-canal side.
  it('never publishes two coupons that both carry the same (fixture, market, pick) under different canals', () => {
    const valueHome = makePick({
      fixtureId: 'crosscanal',
      canal: 'VALUE',
      market: 'ONE_X_TWO',
      probability: 0.6,
      calibratedHitRate: 0.6,
      oddsSnapshot: 1.7,
      signalScore: 0.9,
      competition: 'Cross Canal League',
    });
    const dominantHome = makePick({
      fixtureId: 'crosscanal',
      canal: 'DOMINANT',
      market: 'ONE_X_TWO',
      probability: 0.6,
      calibratedHitRate: 0.6,
      oddsSnapshot: 1.7,
      signalScore: 0.85,
      competition: 'Cross Canal League',
    });
    const partners = ['q1', 'q2', 'q3', 'q4'].map((id, i) =>
      makePick({
        fixtureId: id,
        canal: 'SAFE',
        market: `MARKET_${id}`,
        probability: 0.55,
        calibratedHitRate: 0.55,
        oddsSnapshot: 2.0,
        signalScore: 0.8 - i * 0.01,
        competition: `League ${id}`,
      }),
    );

    const coupons = service.compose(
      [valueHome, dominantHome, ...partners],
      DIVERSITY_TEST_PROFILE,
    );
    const withCrossCanal = coupons.filter((c) =>
      c.legs.some((l) => l.fixtureId === 'crosscanal'),
    );
    expect(withCrossCanal.length).toBeLessThanOrEqual(1);
  });
});

describe('clearsMaxLegEdge', () => {
  const leg = (probability: number, oddsSnapshot: number | null) => ({
    calibratedProbability: probability,
    probability,
    calibratedHitRate: probability,
    oddsSnapshot,
  });

  it('accepts a leg whose model↔market divergence stays inside the measured band', () => {
    expect(clearsMaxLegEdge(leg(0.55, 2.0))).toBe(true); // edge 0.05
  });

  it('rejects a leg claiming more edge than the model has been measured to have', () => {
    // edge 0.30 — la tranche qui ne réalise que 0.537 de ce qu'elle annonce
    expect(clearsMaxLegEdge(leg(0.7, 2.5))).toBe(false);
  });

  it('accepts a leg the model prices BELOW the market (negative edge)', () => {
    // ratio 1.062 dans cette zone : le modèle y est sous-confiant
    expect(clearsMaxLegEdge(leg(0.4, 2.0))).toBe(true);
  });

  it('rejects a leg with no real odds — edge is undefined without a price', () => {
    expect(clearsMaxLegEdge(leg(0.6, null))).toBe(false);
  });

  // Le point critique du passage au meilleur prix : miser plus cher ne doit
  // pas relâcher le plafond de divergence. Même jambe, prix de mise amélioré
  // de 2.0 à 2.6 — l'edge mesuré ne bouge pas, parce qu'il se calcule sur la
  // cote de référence.
  it('measures the edge on the reference odds, not on the improved stake price', () => {
    const improved = {
      calibratedProbability: 0.55,
      probability: 0.55,
      calibratedHitRate: 0.55,
      oddsSnapshot: 2.6, // meilleur prix : 0.55 - 1/2.6 = 0.165 > MAX_LEG_EDGE
      referenceOdds: 2.0, // référence   : 0.55 - 1/2.0 = 0.05  <= MAX_LEG_EDGE
    };
    expect(clearsMaxLegEdge(improved)).toBe(true);

    const genuinelyDivergent = { ...improved, referenceOdds: 2.6 };
    expect(clearsMaxLegEdge(genuinelyDivergent)).toBe(false);
  });
});

describe('clearsMinLegOdds', () => {
  it('rejects a leg priced below the product floor', () => {
    // Le cas réel du 2026-08-22 : une jambe à 1.04 dans un coupon à 1.30.
    expect(clearsMinLegOdds({ oddsSnapshot: 1.04 })).toBe(false);
    expect(clearsMinLegOdds({ oddsSnapshot: 1.19 })).toBe(false);
  });

  it('accepts a leg at or above the floor', () => {
    expect(clearsMinLegOdds({ oddsSnapshot: 1.2 })).toBe(true);
    expect(clearsMinLegOdds({ oddsSnapshot: 2.4 })).toBe(true);
  });

  it('rejects a leg with no real odds', () => {
    expect(clearsMinLegOdds({ oddsSnapshot: null })).toBe(false);
  });

  // Ce qui différencie les classes : chacune n'admet que sa bande de cote, et
  // les bandes sont disjointes — un même pick ne peut donc jamais apparaître
  // dans deux classes.
  it('confines a leg to its class band, exclusive at the upper bound', () => {
    const safe = { minLegOdds: 1.2, maxLegOdds: 1.6 };
    const balanced = { minLegOdds: 1.6, maxLegOdds: 2.3 };

    expect(clearsMinLegOdds({ oddsSnapshot: 1.45 }, safe)).toBe(true);
    expect(clearsMinLegOdds({ oddsSnapshot: 1.45 }, balanced)).toBe(false);

    // 1.60 appartient à BALANCED, pas à SAFE — borne haute exclusive, sans
    // quoi les bandes se chevaucheraient d'un pick.
    expect(clearsMinLegOdds({ oddsSnapshot: 1.6 }, safe)).toBe(false);
    expect(clearsMinLegOdds({ oddsSnapshot: 1.6 }, balanced)).toBe(true);
  });
});

describe('COUPON_CLASSES', () => {
  it('covers the odds range without gap or overlap', () => {
    for (let i = 1; i < COUPON_CLASSES.length; i += 1) {
      expect(COUPON_CLASSES[i].minLegOdds).toBe(
        COUPON_CLASSES[i - 1].maxLegOdds,
      );
    }
    expect(COUPON_CLASSES[0].minLegOdds).toBe(MIN_LEG_ODDS);
  });

  it('lands each class on a distinct persisted odds range', () => {
    for (let i = 1; i < COUPON_CLASSES.length; i += 1) {
      expect(COUPON_CLASSES[i].targetOddsMin).toBeGreaterThan(
        COUPON_CLASSES[i - 1].targetOddsMax,
      );
    }
  });
});

describe('CouponComposerService.compose — cible de cote par classe', () => {
  const service = new CouponComposerService();
  const legs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) =>
    makeEdgePick({
      fixtureId: id,
      canal: 'DOMINANT',
      market: `MARKET_${id}`,
      oddsSnapshot: 1.5,
      signalScore: 0.9 - i * 0.01,
      competition: `League ${id}`,
    }),
  );

  it('stops adding legs as soon as the class target is reached', () => {
    // 1.5 × 1.5 = 2.25 ≥ 2.0 → deux jambes suffisent, on n'en prend pas trois.
    const [coupon] = service.compose(legs, { targetCombinedOdds: 2.0 });
    expect(coupon.legs).toHaveLength(2);
    expect(coupon.combinedOdds).toBeGreaterThanOrEqual(2.0);
  });

  it('keeps adding legs when the target needs them', () => {
    // 2.25 < 3.0 → il faut la troisième jambe (3.375).
    const [coupon] = service.compose(legs, { targetCombinedOdds: 3.0 });
    expect(coupon.legs).toHaveLength(3);
    expect(coupon.combinedOdds).toBeGreaterThanOrEqual(3.0);
  });

  it('publishes nothing rather than a coupon below its target', () => {
    // 1.5^3 = 3.375 < 50 : aucune construction ne peut atteindre la cible.
    // Publier quand même était le bug du 2026-08-22 — 60% des coupons de la
    // classe à cote courte sortaient sous 2.0, jusqu'à 1.44.
    expect(service.compose(legs, { targetCombinedOdds: 50 })).toHaveLength(0);
  });

  it('reaches the target from deeper in the pool when the top legs cannot', () => {
    // Deux jambes très courtes en tête (produit 1.32 < 2.0) et des jambes plus
    // longues derrière : le glouton doit repartir plus bas dans le vivier
    // plutôt que publier sous la cible.
    const short = ['s1', 's2'].map((id, i) =>
      makeEdgePick({
        fixtureId: id,
        canal: 'SAFE',
        market: `SHORT_${id}`,
        oddsSnapshot: 1.15,
        signalScore: 0.99 - i * 0.01,
        competition: `Short ${id}`,
      }),
    );
    const longer = ['l1', 'l2'].map((id, i) =>
      makeEdgePick({
        fixtureId: id,
        canal: 'DOMINANT',
        market: `LONG_${id}`,
        oddsSnapshot: 1.6,
        signalScore: 0.5 - i * 0.01,
        competition: `Long ${id}`,
      }),
    );

    const [coupon] = service.compose([...short, ...longer], {
      targetCombinedOdds: 2.0,
      bounds: { ...COUPON_BOUNDS, maxLegs: 2 },
    });

    expect(coupon).toBeDefined();
    expect(coupon.combinedOdds).toBeGreaterThanOrEqual(2.0);
  });
});
