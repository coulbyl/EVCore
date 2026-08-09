import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { VALUE_MIN_EDGE } from '@evcore/analysis-core';
import { MIN_BET_COUNT } from '@modules/adjustment/adjustment.constants';
import {
  calculateEV,
  calculateKellyStakePct,
} from '@modules/betting-engine/betting-engine.utils';
import {
  DEFAULT_STAKE_PCT,
  KELLY_FRACTION,
  KELLY_MAX_STAKE_PCT,
  getValueMinEdge,
} from '@modules/betting-engine/ev.constants';
import {
  COUPON_PARAMS,
  CANAL_BASE_WEIGHT,
  DEFAULT_COUPON_PROFILE,
  EXHAUSTIVE_LEG_THRESHOLD,
  GREEDY_START_VARIANTS,
  type CouponProfileBounds,
} from './coupon.constants';
import type {
  MarketCalibration,
  ScoredPick,
  SignalWindow,
} from './signal-window.service';

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const MIN_DISTINCT_FIXTURES = 2;
const MAX_POOL_SIZE = 25;

export type ComposedCoupon = {
  rank: number;
  legs: ScoredPick[];
  combinedOdds: number;
  jointProbability: number;
  /** EV du coupon : `P_coupon × Odd_coupon − 1` (cf. DESIGN.md Étape 1). */
  couponEV: number;
  signalScore: number;
  reasoning: Record<string, unknown>;
};

// jointProbability was previously the product of canal-level calibrated hit
// rates only — every coupon with the same canal mix stored the identical value
// (audit 2026-06-11: six pending coupons all at 0.4743 = SAFE rate × BTTS rate),
// making the viability filter and the jointProbability sort degenerate among
// same-canal combos. Blending each pick's model probability with its canal
// calibrated rate keeps the calibration tempering (raw model probabilities are
// over-confident) while restoring pick-specific joint probabilities.
export const LEG_PROBABILITY_MODEL_WEIGHT = 0.5;

export function calibratedLegProbability(leg: {
  probability: number;
  calibratedHitRate: number;
}): number {
  return (
    leg.probability * LEG_PROBABILITY_MODEL_WEIGHT +
    leg.calibratedHitRate * (1 - LEG_PROBABILITY_MODEL_WEIGHT)
  );
}

// Markets with a production calibration sample — these are exactly the markets
// CalibrationService tracks (ONE_X_TWO / OVER_UNDER / BTTS / TEAM_TOTAL_HOME /
// TEAM_TOTAL_AWAY / OVER_UNDER_HT). Other leg markets (DOUBLE_CHANCE, …) have no
// measured bias and fall back to the legacy blend. TEAM_TOTAL_HOME/AWAY added
// 2026-08 alongside TEAM_TOTAL staking — betCount was 28/19 (VALUE/SAFE picks
// landing on these markets) as of 2026-07-28, both below MIN_BET_COUNT=50, but
// the `cal.betCount >= MIN_BET_COUNT` gate below already ramps this up safely:
// it silently keeps using the legacy blend until each market crosses 50, no
// separate activation step needed once that happens. OVER_UNDER_HT added
// 2026-08-01 (subscription audit): 132 settled bets, meanError +0.075
// (mild overconfidence) — coupon legs on this market were previously
// unadjusted, e.g. a repeated 0.76-modelled UNDER_1_5 HT pick that lost
// across all three ranked coupons on 2026-07-29.
const CALIBRATED_MARKETS = new Set([
  'ONE_X_TWO',
  'OVER_UNDER',
  'BTTS',
  'TEAM_TOTAL_HOME',
  'TEAM_TOTAL_AWAY',
  'OVER_UNDER_HT',
]);

// Principled per-market calibration: shift the raw model probability by the
// measured mean signed error (meanError = mean(p − outcome); positive = the
// model is over-confident, so we subtract it). This replaces the arbitrary
// 50/50 model-vs-canal blend with an empirical, data-backed correction.
// Falls back to `calibratedLegProbability` when the leg's market has no
// production calibration sample (untracked market, or < MIN_BET_COUNT bets).
export function calibrateLegProbability(
  leg: { probability: number; calibratedHitRate: number; market: string },
  marketCalibration: MarketCalibration,
): number {
  const cal = marketCalibration[leg.market];
  if (
    cal &&
    CALIBRATED_MARKETS.has(leg.market) &&
    cal.betCount >= MIN_BET_COUNT
  ) {
    const corrected = leg.probability - cal.meanError;
    return Math.min(
      COUPON_PARAMS.capMax,
      Math.max(COUPON_PARAMS.capMin, corrected),
    );
  }
  return calibratedLegProbability(leg);
}

// Single source of truth for a leg's probability inside a coupon: the calibrated
// value when scoring has run, otherwise the legacy blend (keeps `compose()`
// correct even when called without a prior `scorePicks`, e.g. in unit tests).
export function legProbability(leg: {
  calibratedProbability?: number | null;
  probability: number;
  calibratedHitRate: number;
}): number {
  return leg.calibratedProbability ?? calibratedLegProbability(leg);
}

// signalScore is a (canal, dow, league) environment rate — within one canal on
// one day it is constant across picks, so a sort on signalScore alone leaves
// same-canal picks in arbitrary (insertion) order. Tie-break on the blended
// pick probability so pool cuts and per-canal selections are deterministic and
// favour the stronger pick.
export function comparePicksBySignalThenProbability(
  a: {
    signalScore: number;
    probability: number;
    calibratedHitRate: number;
    calibratedProbability?: number | null;
  },
  b: {
    signalScore: number;
    probability: number;
    calibratedHitRate: number;
    calibratedProbability?: number | null;
  },
): number {
  if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore;
  return legProbability(b) - legProbability(a);
}

// VALUE-only edge floor, mirroring the standalone VALUE channel's own gate
// (`selectBestViablePick` in analysis-core: probability − 1/odds ≥
// getValueMinEdge(league) ?? VALUE_MIN_EDGE=0.10). Before this, a VALUE leg
// that would be REJECTED as a standalone VALUE pick could still ride into a
// coupon whenever a partner leg's EV compensated for it at the combined-coupon
// level — audit 2026-08-01 found COUPON_ALL subscriptions at 0/19 settled
// wins. SAFE/BTTS/... legs are unaffected: VALUE_MIN_EDGE is deliberately
// VALUE-only, same as in the channel strategy.
export function clearsValueEdgeFloor(
  leg: {
    canal: string;
    calibratedProbability: number | null;
    oddsSnapshot: number | null;
    featureSnapshot: Record<string, unknown>;
  },
  getMinEdge: (
    competitionCode: string | null,
  ) => Decimal | undefined = getValueMinEdge,
): boolean {
  if (leg.canal !== 'VALUE') return true;
  if (leg.calibratedProbability === null || leg.oddsSnapshot === null) {
    return false;
  }
  const competitionCode =
    (leg.featureSnapshot['competitionCode'] as string | undefined) ?? null;
  const minEdge = getMinEdge(competitionCode) ?? VALUE_MIN_EDGE;
  const edge = new Decimal(leg.calibratedProbability).minus(
    new Decimal(1).div(leg.oddsSnapshot),
  );
  return edge.greaterThanOrEqualTo(minEdge);
}

// Shared anti-correlation bookkeeping — used identically by composeExhaustive
// (DFS) and composeGreedy (longshot) so the two strategies can never drift
// apart on what counts as "too correlated" (1/fixture, 1/canal+market,
// 2/competition, and an optional per-day cap for multi-day pools).
type AntiCorrelationState = {
  canalMarketCounts: Map<string, number>;
  compCounts: Map<string, number>;
  dayCounts: Map<string, number>;
};

function createAntiCorrelationState(legs: ScoredPick[]): AntiCorrelationState {
  const state: AntiCorrelationState = {
    canalMarketCounts: new Map(),
    compCounts: new Map(),
    dayCounts: new Map(),
  };
  for (const leg of legs) recordAntiCorrelation(state, leg);
  return state;
}

function recordAntiCorrelation(
  state: AntiCorrelationState,
  leg: ScoredPick,
): void {
  const cmKey = `${leg.canal}:${leg.market}`;
  state.canalMarketCounts.set(
    cmKey,
    (state.canalMarketCounts.get(cmKey) ?? 0) + 1,
  );
  state.compCounts.set(
    leg.competition,
    (state.compCounts.get(leg.competition) ?? 0) + 1,
  );
  state.dayCounts.set(
    leg.dayBucket,
    (state.dayCounts.get(leg.dayBucket) ?? 0) + 1,
  );
}

function violatesAntiCorrelation(
  current: ScoredPick[],
  next: ScoredPick,
  ctx: { state: AntiCorrelationState; profile: CouponProfileBounds },
): boolean {
  const { state, profile } = ctx;
  if (current.some((p) => p.fixtureId === next.fixtureId)) return true;

  const cmKey = `${next.canal}:${next.market}`;
  if ((state.canalMarketCounts.get(cmKey) ?? 0) >= 1) return true;

  if ((state.compCounts.get(next.competition) ?? 0) >= 2) return true;

  if (
    profile.maxLegsPerDay !== undefined &&
    (state.dayCounts.get(next.dayBucket) ?? 0) >= profile.maxLegsPerDay
  ) {
    return true;
  }

  return false;
}

function legKey(leg: ScoredPick): string {
  return `${leg.fixtureId}:${leg.canal}:${leg.market}:${leg.pick}`;
}

// Above this fraction of a candidate's legs already appearing in a coupon
// we've already selected, it reads as "the same bet again" rather than a
// genuinely different option — the exact complaint that motivated this
// (plan 2026-08-09): the strongest leg in the pool would ride into nearly
// every one of the top-N coupons by EV alone, since removing it barely moves
// the ranking. This is a presentation/diversity policy, not a probability
// threshold — no backtest gate needed, unlike EV/odds/probability bounds.
const MAX_SHARED_LEG_RATIO = 0.5;

function sharedLegRatio(
  candidate: ComposedCoupon,
  against: ComposedCoupon,
): number {
  const againstKeys = new Set(against.legs.map(legKey));
  const shared = candidate.legs.filter((l) =>
    againstKeys.has(legKey(l)),
  ).length;
  return shared / candidate.legs.length;
}

// Greedy selection from the EV-sorted viable list: take the best coupon,
// then keep taking the next-best one that doesn't overlap too heavily with
// what's already picked — same EV-first ranking, but the top-N no longer
// collapse into near-duplicates of each other. Backfills with the best
// remaining candidates (ignoring overlap) if the pool is too thin to fill
// `maxCoupons` diversely, so this never returns fewer coupons than before.
function selectDiverseCoupons(
  viableSortedByEV: ComposedCoupon[],
  maxCoupons: number,
): ComposedCoupon[] {
  const selected: ComposedCoupon[] = [];
  for (const candidate of viableSortedByEV) {
    if (selected.length >= maxCoupons) break;
    const tooSimilar = selected.some(
      (s) => sharedLegRatio(candidate, s) >= MAX_SHARED_LEG_RATIO,
    );
    if (!tooSimilar) selected.push(candidate);
  }
  if (selected.length < maxCoupons) {
    for (const candidate of viableSortedByEV) {
      if (selected.length >= maxCoupons) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
  }
  return selected;
}

@Injectable()
export class CouponComposerService {
  // Day-of-week factor is read per-pick from its OWN `dayBucket` — a
  // multi-day pool (weekend/midweek window, cf. SignalWindowService
  // .getPoolForRange) mixes fixtures from different days, so a single `date`
  // parameter applied to every pick would misattribute Saturday/Sunday legs
  // to Friday's dow factor.
  scorePicks(picks: ScoredPick[], window: SignalWindow): ScoredPick[] {
    return picks.map((pick) => {
      const d = new Date(`${pick.dayBucket}T12:00:00.000Z`);
      const dow = DOW_LABELS[(d.getUTCDay() + 6) % 7];
      const canalBase = CANAL_BASE_WEIGHT[pick.canal];
      const windowRate =
        window.calibratedCanalHitRates[pick.canal] ?? canalBase;
      const dowRate = window.canalDowFactors[pick.canal]?.[dow] ?? windowRate;
      const leagueRate =
        window.calibratedCanalLeagueHitRates[pick.canal]?.[pick.competition] ??
        windowRate;

      // 50% canal calibrated rate, 30% dow factor, 20% league calibrated rate
      const signalScore = windowRate * 0.5 + dowRate * 0.3 + leagueRate * 0.2;

      const calibratedProbability = calibrateLegProbability(
        {
          probability: pick.probability,
          calibratedHitRate: windowRate,
          market: pick.market,
        },
        window.marketCalibration,
      );
      const marketMeanError =
        window.marketCalibration[pick.market]?.meanError ?? null;

      // EV de jambe sur la cote RÉELLE uniquement (jamais de cote inventée) —
      // une jambe sans cote ne porte pas d'EV et sera exclue des coupons.
      const legEV =
        pick.oddsSnapshot !== null
          ? calculateEV(calibratedProbability, pick.oddsSnapshot).toNumber()
          : null;

      // Edge marché = proba calibrée − proba « fair » (overround retiré).
      // Mesure la value vs le marché (pas « car sûr »). `null` si pas de fair.
      const edge =
        pick.pMarketFair !== null
          ? calibratedProbability - pick.pMarketFair
          : null;

      const featureSnapshot = {
        ...pick.featureSnapshot,
        canal: pick.canal,
        league: pick.competition,
        dow,
        calibratedCanalHitRate: windowRate,
        dowHitRate: dowRate,
        calibratedLeagueHitRate: leagueRate,
        signalScore,
        calibratedProbability,
        marketMeanError,
        legEV,
        pMarketFair: pick.pMarketFair,
        bookmakerMargin: pick.bookmakerMargin,
        edge,
      };

      return {
        ...pick,
        calibratedHitRate: windowRate,
        calibratedProbability,
        legEV,
        edge,
        signalScore,
        featureSnapshot,
      };
    });
  }

  compose(
    scoredPicks: ScoredPick[],
    profile: CouponProfileBounds = DEFAULT_COUPON_PROFILE,
  ): ComposedCoupon[] {
    // EVCore est value-driven : un coupon ne se construit que sur des jambes à
    // cote RÉELLE (B2 — plus de FALLBACK_ODDS). Une jambe sans cote n'a pas d'EV.
    const pricedPicks = scoredPicks
      .filter((p) => p.oddsSnapshot !== null)
      .filter((p) => clearsValueEdgeFloor(p));

    const distinctFixtures = new Set(pricedPicks.map((p) => p.fixtureId));
    if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) return [];

    const pool = [...pricedPicks]
      .sort(comparePicksBySignalThenProbability)
      .slice(0, MAX_POOL_SIZE);

    // Exhaustive DFS stays exact and cheap up to EXHAUSTIVE_LEG_THRESHOLD legs
    // (C(25,5)≈2300 combinations); beyond that (longshot profiles, 8-12 legs)
    // it explodes (C(25,10)≈3.3M) — composeGreedy trades exactness for a
    // handful of good-enough candidates. Both share buildCoupon and the
    // anti-correlation rules above, so neither can silently diverge from the
    // other on what makes two legs "too correlated".
    const candidates: ComposedCoupon[] =
      profile.maxLegs <= EXHAUSTIVE_LEG_THRESHOLD
        ? this.composeExhaustive(pool, profile)
        : this.composeGreedy(pool, profile);

    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const key = c.legs
        .map((l) => legKey(l))
        .sort()
        .join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filtre value (bornes du profil) : nombre de jambes, cote combinée, proba
    // jointe ET EV de coupon. Tri par EV décroissante (ADN value), proba jointe en
    // tie-break, puis le coupon le plus court à EV égale (cf. DESIGN.md §5).
    const viable = unique
      .filter(
        (c) =>
          c.legs.length >= profile.minLegs &&
          c.combinedOdds >= profile.minCombinedOdds &&
          c.jointProbability >= profile.minJointProbability &&
          c.couponEV >= profile.minCouponEV,
      )
      .sort(compareCouponsByEV);

    return selectDiverseCoupons(viable, COUPON_PARAMS.maxCoupons).map(
      (c, i) => ({ ...c, rank: i + 1 }),
    );
  }

  private composeExhaustive(
    pool: ScoredPick[],
    profile: CouponProfileBounds,
  ): ComposedCoupon[] {
    const candidates: ComposedCoupon[] = [];
    this.buildCombinations(pool, [], { out: candidates, profile });
    return candidates;
  }

  private buildCombinations(
    remaining: ScoredPick[],
    current: ScoredPick[],
    ctx: { out: ComposedCoupon[]; profile: CouponProfileBounds },
  ): void {
    const { out, profile } = ctx;
    if (current.length > profile.maxLegs) return;

    const combinedOdds = this.computeCombinedOdds(current);
    if (combinedOdds > profile.maxCombinedOdds) return;

    if (current.length >= 2) {
      const distinctFixtures = new Set(current.map((p) => p.fixtureId));
      if (distinctFixtures.size >= MIN_DISTINCT_FIXTURES) {
        out.push(this.buildCoupon(current, combinedOdds));
      }
    }

    if (current.length === profile.maxLegs) return;

    const state = createAntiCorrelationState(current);

    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      if (violatesAntiCorrelation(current, next, { state, profile })) continue;
      this.buildCombinations(remaining.slice(i + 1), [...current, next], ctx);
    }
  }

  // Longshot composition (8-12+ legs, cote cible 50-70) — a bounded greedy
  // walk instead of the exhaustive DFS above, which is intractable at this
  // leg count (cf. EXHAUSTIVE_LEG_THRESHOLD). Tries GREEDY_START_VARIANTS
  // distinct starting legs (the pool is already sorted by signal strength),
  // each time greedily accepting the next-best remaining leg that doesn't
  // violate anti-correlation or push combinedOdds past the profile ceiling —
  // skipping (not stopping on) a leg that would breach the ceiling, so a
  // single strong-odds candidate doesn't prematurely end the walk.
  private composeGreedy(
    pool: ScoredPick[],
    profile: CouponProfileBounds,
  ): ComposedCoupon[] {
    const candidates: ComposedCoupon[] = [];
    const variantCount = Math.min(pool.length, GREEDY_START_VARIANTS);

    for (let start = 0; start < variantCount; start++) {
      const current: ScoredPick[] = [pool[start]];
      const state = createAntiCorrelationState(current);

      for (let i = 0; i < pool.length; i++) {
        if (i === start) continue;
        if (current.length >= profile.maxLegs) break;

        const next = pool[i];
        if (violatesAntiCorrelation(current, next, { state, profile }))
          continue;

        const combinedOdds = this.computeCombinedOdds([...current, next]);
        if (combinedOdds > profile.maxCombinedOdds) continue;

        current.push(next);
        recordAntiCorrelation(state, next);
      }

      if (current.length < 2) continue;
      const distinctFixtures = new Set(current.map((p) => p.fixtureId));
      if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) continue;

      candidates.push(
        this.buildCoupon(current, this.computeCombinedOdds(current)),
      );
    }

    return candidates;
  }

  private computeCombinedOdds(legs: ScoredPick[]): number {
    return legs.reduce((acc, leg) => {
      // Invariant compose() : seules des jambes à cote réelle arrivent ici.
      if (leg.oddsSnapshot === null) {
        throw new Error('compose: leg without real odds reached combinedOdds');
      }
      return acc * leg.oddsSnapshot;
    }, 1);
  }

  private buildCoupon(
    legs: ScoredPick[],
    combinedOdds: number,
  ): ComposedCoupon {
    const jointProbability = legs.reduce(
      (acc, leg) => acc * legProbability(leg),
      1,
    );
    // couponEV = P_coupon × Odd_coupon − 1 (source unique calculateEV).
    const couponEV = calculateEV(jointProbability, combinedOdds).toNumber();
    const signalScore =
      legs.reduce((acc, leg) => acc + leg.signalScore, 0) / legs.length;

    const reasoning: Record<string, unknown> = {
      legs: legs.map((l) => ({
        fixture: `${l.homeTeam} vs ${l.awayTeam}`,
        canal: l.canal,
        pick: `${l.market}/${l.pick}`,
        signalScore: l.signalScore,
        legEV: l.legEV,
        edge: l.edge,
        pMarketFair: l.pMarketFair,
        calibratedCanalHitRate:
          (l.featureSnapshot['calibratedCanalHitRate'] as number | undefined) ??
          null,
      })),
      combinedOdds,
      jointProbability,
      couponEV,
      signalScore,
    };

    return {
      rank: 0,
      legs,
      combinedOdds,
      jointProbability,
      couponEV,
      signalScore,
      reasoning,
    };
  }
}

// Classement value-driven (DESIGN.md §5) : EV de coupon d'abord, proba jointe en
// tie-break, puis le coupon le plus court à EV/proba égales.
export function compareCouponsByEV(
  a: ComposedCoupon,
  b: ComposedCoupon,
): number {
  if (b.couponEV !== a.couponEV) return b.couponEV - a.couponEV;
  if (b.jointProbability !== a.jointProbability) {
    return b.jointProbability - a.jointProbability;
  }
  return a.legs.length - b.legs.length;
}

// Mise recommandée pour un coupon (% bankroll), Étape 5 / B10. Derrière
// `KELLY_ENABLED` : Kelly fractionnaire sur (P_coupon, Odd_coupon) via la formule
// canonique `calculateKellyStakePct` (jamais de Kelly inline) ; sinon mise plate
// `DEFAULT_STAKE_PCT`. Renvoie 0 si Kelly ≤ 0 (coupon sans value — déjà filtré).
export function recommendedCouponStakePct(
  coupon: { jointProbability: number; combinedOdds: number },
  kellyEnabled: boolean,
): number {
  if (!kellyEnabled) return DEFAULT_STAKE_PCT.toNumber();
  return calculateKellyStakePct(coupon.jointProbability, coupon.combinedOdds, {
    fraction: KELLY_FRACTION,
    maxStake: KELLY_MAX_STAKE_PCT,
  }).toNumber();
}
