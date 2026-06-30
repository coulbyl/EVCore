import { Injectable } from '@nestjs/common';
import { MIN_BET_COUNT } from '@modules/adjustment/adjustment.constants';
import {
  calculateEV,
  calculateKellyStakePct,
} from '@modules/betting-engine/betting-engine.utils';
import {
  DEFAULT_STAKE_PCT,
  KELLY_FRACTION,
  KELLY_MAX_STAKE_PCT,
} from '@modules/betting-engine/ev.constants';
import {
  COUPON_PARAMS,
  CANAL_BASE_WEIGHT,
  DEFAULT_COUPON_PROFILE,
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
// CalibrationService tracks (ONE_X_TWO / OVER_UNDER / BTTS). Other leg markets
// (OVER_UNDER_HT, DOUBLE_CHANCE, …) have no measured bias and fall back to the
// legacy blend.
const CALIBRATED_MARKETS = new Set(['ONE_X_TWO', 'OVER_UNDER', 'BTTS']);

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

@Injectable()
export class CouponComposerService {
  scorePicks(
    picks: ScoredPick[],
    window: SignalWindow,
    date: string,
  ): ScoredPick[] {
    const d = new Date(`${date}T12:00:00.000Z`);
    const dow = DOW_LABELS[(d.getUTCDay() + 6) % 7];

    return picks.map((pick) => {
      const canalBase = CANAL_BASE_WEIGHT[pick.canal];
      const windowRate =
        window.calibratedCanalHitRates[pick.canal] ?? canalBase;
      const dowRate = window.canalDowFactors[pick.canal]?.[dow] ?? windowRate;
      const leagueRate =
        window.calibratedCanalLeagueHitRates[pick.canal]?.[pick.competition] ??
        windowRate;

      // 50% canal calibrated rate, 30% dow factor, 20% league calibrated rate
      const signalScore = windowRate * 0.5 + dowRate * 0.3 + leagueRate * 0.2;

      // Same-match combos carry a bivariate-Poisson joint probability — a
      // single-market bias shift doesn't apply, so keep the joint as-is.
      const isCombo = pick.comboMarket !== null;
      const calibratedProbability = isCombo
        ? pick.probability
        : calibrateLegProbability(
            {
              probability: pick.probability,
              calibratedHitRate: windowRate,
              market: pick.market,
            },
            window.marketCalibration,
          );
      const marketMeanError = isCombo
        ? null
        : (window.marketCalibration[pick.market]?.meanError ?? null);

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
    const pricedPicks = scoredPicks.filter((p) => p.oddsSnapshot !== null);

    const distinctFixtures = new Set(pricedPicks.map((p) => p.fixtureId));
    if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) return [];

    const pool = [...pricedPicks]
      .sort(comparePicksBySignalThenProbability)
      .slice(0, MAX_POOL_SIZE);

    const candidates: ComposedCoupon[] = [];
    this.buildCombinations(pool, [], { out: candidates, profile });

    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const key = c.legs
        .map((l) => `${l.fixtureId}:${l.canal}:${l.market}:${l.pick}`)
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

    return viable
      .slice(0, COUPON_PARAMS.maxCoupons)
      .map((c, i) => ({ ...c, rank: i + 1 }));
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

    const canalMarketCounts = new Map<string, number>();
    const compCounts = new Map<string, number>();
    for (const p of current) {
      const cmKey = `${p.canal}:${p.market}`;
      canalMarketCounts.set(cmKey, (canalMarketCounts.get(cmKey) ?? 0) + 1);
      compCounts.set(p.competition, (compCounts.get(p.competition) ?? 0) + 1);
    }

    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];

      // Anti-correlation: no two legs from the same fixture
      if (current.some((p) => p.fixtureId === next.fixtureId)) continue;

      // Anti-correlation: max 1 leg per (canal, market)
      const cmKey = `${next.canal}:${next.market}`;
      if ((canalMarketCounts.get(cmKey) ?? 0) >= 1) continue;

      // Anti-correlation: max 2 legs per competition
      if ((compCounts.get(next.competition) ?? 0) >= 2) continue;

      this.buildCombinations(remaining.slice(i + 1), [...current, next], ctx);
    }
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
        pick:
          l.comboMarket !== null
            ? `${l.market}/${l.pick} + ${l.comboMarket}/${l.comboPick}`
            : `${l.market}/${l.pick}`,
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
