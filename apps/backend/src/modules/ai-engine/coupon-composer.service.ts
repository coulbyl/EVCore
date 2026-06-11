import { Injectable } from '@nestjs/common';
import { CANAL_BASE_WEIGHT, INVESTMENT_PARAMS } from './investment.constants';
import type { Canal, ScoredPick, SignalWindow } from './signal-window.service';

const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const MIN_DISTINCT_FIXTURES = 2;
const MAX_POOL_SIZE = 25;

const FALLBACK_ODDS: Record<Canal, number> = {
  SV: 1.65,
  CONF: 2.2,
  BB: 1.75,
  EV: 1.85,
  NUL: 3.2,
};

export type ComposedCoupon = {
  rank: number;
  legs: ScoredPick[];
  combinedOdds: number;
  jointProbability: number;
  signalScore: number;
  reasoning: Record<string, unknown>;
};

// jointProbability was previously the product of canal-level calibrated hit
// rates only — every coupon with the same canal mix stored the identical value
// (audit 2026-06-11: six pending coupons all at 0.4743 = SV rate × BB rate),
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

// signalScore is a (canal, dow, league) environment rate — within one canal on
// one day it is constant across picks, so a sort on signalScore alone leaves
// same-canal picks in arbitrary (insertion) order. Tie-break on the blended
// pick probability so pool cuts and per-canal selections are deterministic and
// favour the stronger pick.
export function comparePicksBySignalThenProbability(
  a: { signalScore: number; probability: number; calibratedHitRate: number },
  b: { signalScore: number; probability: number; calibratedHitRate: number },
): number {
  if (b.signalScore !== a.signalScore) return b.signalScore - a.signalScore;
  return calibratedLegProbability(b) - calibratedLegProbability(a);
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

      const featureSnapshot = {
        ...pick.featureSnapshot,
        canal: pick.canal,
        league: pick.competition,
        dow,
        calibratedCanalHitRate: windowRate,
        dowHitRate: dowRate,
        calibratedLeagueHitRate: leagueRate,
        signalScore,
      };

      return {
        ...pick,
        calibratedHitRate: windowRate,
        signalScore,
        featureSnapshot,
      };
    });
  }

  compose(scoredPicks: ScoredPick[]): ComposedCoupon[] {
    const distinctFixtures = new Set(scoredPicks.map((p) => p.fixtureId));
    if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) return [];

    const pool = [...scoredPicks]
      .sort(comparePicksBySignalThenProbability)
      .slice(0, MAX_POOL_SIZE);

    const candidates: ComposedCoupon[] = [];
    this.buildCombinations(pool, [], candidates);

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

    const viable = unique
      .filter(
        (c) =>
          c.jointProbability >= INVESTMENT_PARAMS.minCalibratedJointProbability,
      )
      .sort((a, b) => b.jointProbability - a.jointProbability);

    return viable
      .slice(0, INVESTMENT_PARAMS.maxCoupons)
      .map((c, i) => ({ ...c, rank: i + 1 }));
  }

  private buildCombinations(
    remaining: ScoredPick[],
    current: ScoredPick[],
    out: ComposedCoupon[],
  ): void {
    if (current.length > INVESTMENT_PARAMS.maxLegs) return;

    const combinedOdds = this.computeCombinedOdds(current);
    if (combinedOdds > INVESTMENT_PARAMS.maxCombinedOdds) return;

    if (current.length >= 2) {
      const distinctFixtures = new Set(current.map((p) => p.fixtureId));
      if (distinctFixtures.size >= MIN_DISTINCT_FIXTURES) {
        out.push(this.buildCoupon(current, combinedOdds));
      }
    }

    if (current.length === INVESTMENT_PARAMS.maxLegs) return;

    // Pre-compute counts for anti-correlation checks
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

      this.buildCombinations(remaining.slice(i + 1), [...current, next], out);
    }
  }

  private computeCombinedOdds(legs: ScoredPick[]): number {
    if (legs.length === 0) return 1;
    return legs.reduce((acc, leg) => {
      const odds = leg.oddsSnapshot ?? FALLBACK_ODDS[leg.canal];
      return acc * odds;
    }, 1);
  }

  private buildCoupon(
    legs: ScoredPick[],
    combinedOdds: number,
  ): ComposedCoupon {
    // Per-leg blend of model probability and calibrated canal hit rate —
    // see calibratedLegProbability above.
    const jointProbability = legs.reduce(
      (acc, leg) => acc * calibratedLegProbability(leg),
      1,
    );
    const signalScore =
      legs.reduce((acc, leg) => acc + leg.signalScore, 0) / legs.length;

    const reasoning: Record<string, unknown> = {
      legs: legs.map((l) => ({
        fixture: `${l.homeTeam} vs ${l.awayTeam}`,
        canal: l.canal,
        pick: `${l.market}/${l.pick}`,
        signalScore: l.signalScore,
        calibratedCanalHitRate:
          (l.featureSnapshot['calibratedCanalHitRate'] as number | undefined) ??
          null,
      })),
      combinedOdds,
      jointProbability,
      signalScore,
    };

    return {
      rank: 0,
      legs,
      combinedOdds,
      jointProbability,
      signalScore,
      reasoning,
    };
  }
}
