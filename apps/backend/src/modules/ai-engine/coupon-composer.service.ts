import { Injectable } from '@nestjs/common';
import type { Canal, ScoredPick, SignalWindow } from './signal-window.service';

// Canal base weights derived from 38-day hit rate analysis
const CANAL_BASE_WEIGHT: Record<Canal, number> = {
  SV: 0.74,
  CONF: 0.66,
  BB: 0.62,
  EV: 0.36,
  NUL: 0.2,
};

// Day-of-week labels aligned to Mon=0 … Sun=6
const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const MAX_LEGS = 5;
const MAX_COUPONS = 3;
const MIN_DISTINCT_FIXTURES = 2;
// Fallback odds when oddsSnapshot is absent — conservative estimate per canal
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
      const windowRate = window.canalHitRates[pick.canal] ?? canalBase;
      const dowRate = window.canalDowFactors[pick.canal]?.[dow] ?? windowRate;
      const leagueRate =
        window.canalLeagueHitRates[pick.canal]?.[pick.competition] ??
        windowRate;

      // Weighted score: 50% recent window, 30% dow factor, 20% league factor
      const signalScore = windowRate * 0.5 + dowRate * 0.3 + leagueRate * 0.2;

      const featureSnapshot = {
        ...pick.featureSnapshot,
        canal: pick.canal,
        league: pick.competition,
        dow,
        windowHitRate: windowRate,
        dowHitRate: dowRate,
        leagueHitRate: leagueRate,
        signalScore,
      };

      return { ...pick, signalScore, featureSnapshot };
    });
  }

  compose(
    scoredPicks: ScoredPick[],
    oddsMin: number,
    oddsMax: number,
  ): ComposedCoupon[] {
    // Check minimum pool diversity
    const distinctFixtures = new Set(scoredPicks.map((p) => p.fixtureId));
    if (distinctFixtures.size < MIN_DISTINCT_FIXTURES) return [];

    // Sort picks by signalScore desc
    const sorted = [...scoredPicks].sort(
      (a, b) => b.signalScore - a.signalScore,
    );

    const candidates: ComposedCoupon[] = [];

    // Greedy combination builder — try all subsets up to MAX_LEGS
    this.buildCombinations(sorted, [], { oddsMin, oddsMax, out: candidates });

    // Deduplicate by leg fingerprint, sort by jointProbability desc
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

    unique.sort((a, b) => b.jointProbability - a.jointProbability);

    return unique.slice(0, MAX_COUPONS).map((c, i) => ({ ...c, rank: i + 1 }));
  }

  private buildCombinations(
    remaining: ScoredPick[],
    current: ScoredPick[],
    ctx: { oddsMin: number; oddsMax: number; out: ComposedCoupon[] },
  ): void {
    if (current.length > MAX_LEGS) return;

    const combinedOdds = this.computeCombinedOdds(current);

    if (current.length >= 2) {
      const distinctFixtures = new Set(current.map((p) => p.fixtureId));
      if (
        distinctFixtures.size >= MIN_DISTINCT_FIXTURES &&
        combinedOdds >= ctx.oddsMin &&
        combinedOdds <= ctx.oddsMax
      ) {
        ctx.out.push(this.buildCoupon(current, combinedOdds));
      }
    }

    if (combinedOdds > ctx.oddsMax || current.length === MAX_LEGS) return;

    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      // No two legs from the same fixture
      if (current.some((p) => p.fixtureId === next.fixtureId)) continue;
      this.buildCombinations(remaining.slice(i + 1), [...current, next], ctx);
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
    const jointProbability = legs.reduce(
      (acc, leg) => acc * leg.probability,
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
        windowHitRate:
          (l.featureSnapshot['windowHitRate'] as number | undefined) ?? null,
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
