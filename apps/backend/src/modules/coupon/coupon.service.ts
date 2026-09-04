import { Injectable, NotFoundException } from '@nestjs/common';
import { CouponProposalStatus } from '@evcore/db';
import { CouponRepository } from './coupon.repository';
import {
  classForTargetOddsMin,
  INTRADAY_SIGNAL_WINDOW_DAYS,
} from './coupon.constants';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';

// generateCoupons/generateForClass (CouponComposerService's glouton
// deterministic composer) retired 2026-09-03 — coupon composition is now
// apps/vantage-worker's LLM pipeline (pool-query.ts → score-candidates.ts →
// compose-coupon-class.ts → persist-coupon-proposal.ts), which writes
// CouponProposal/CouponProposalLeg directly via @evcore/db, never through
// this service. CouponPoolService (whose only caller was generateCoupons)
// retired alongside it — see docs/vantage-centric-redesign-2026-09-01.md
// §9bis. CouponService now only reads.
@Injectable()
export class CouponService {
  constructor(private readonly repo: CouponRepository) {}

  async getCoupons(
    date: string,
    userId: string,
    status?: CouponProposalStatus,
  ): Promise<CouponProposalDto[]> {
    const forDate = new Date(`${date}T00:00:00.000Z`);
    const proposals = await this.repo.findByDate(forDate, userId, status);

    return proposals.map((p) => ({
      id: p.id,
      forDate: p.forDate.toISOString().slice(0, 10),
      rank: p.rank,
      signalWindowDays: p.signalWindowDays,
      targetOddsMin: Number(p.targetOddsMin),
      targetOddsMax: Number(p.targetOddsMax),
      couponClass: classForTargetOddsMin(Number(p.targetOddsMin)),
      batch:
        p.signalWindowDays === INTRADAY_SIGNAL_WINDOW_DAYS
          ? 'intraday'
          : 'evening',
      combinedOdds: Number(p.combinedOdds),
      jointProbability: Number(p.jointProbability),
      signalScore: Number(p.signalScore),
      status: p.status,
      viewerCount: p._count.views,
      playerCount: p._count.placements,
      playedByMe: p.placements.length > 0,
      result: p.result,
      reasoning: p.reasoning as Record<string, unknown> | null,
      lastFixtureScheduledAt: p.lastFixtureScheduledAt.toISOString(),
      generatedAt: p.generatedAt.toISOString(),
      legs: p.legs.map((leg) => ({
        id: leg.id,
        fixtureId: leg.fixtureId,
        homeTeam: leg.fixture.homeTeam.name,
        homeLogo: leg.fixture.homeTeam.logoUrl ?? null,
        awayTeam: leg.fixture.awayTeam.name,
        awayLogo: leg.fixture.awayTeam.logoUrl ?? null,
        competition: leg.fixture.season.competition.code,
        competitionName: leg.fixture.season.competition.name,
        country: leg.fixture.season.competition.country,
        scheduledAt: leg.fixture.scheduledAt.toISOString(),
        score: formatFixtureScore({
          homeScore: leg.fixture.homeScore,
          awayScore: leg.fixture.awayScore,
        }),
        htScore: formatFixtureScore({
          homeScore: leg.fixture.homeHtScore,
          awayScore: leg.fixture.awayHtScore,
        }),
        canal: leg.canal,
        market: leg.market,
        pick: leg.pick,
        probability: Number(leg.probability),
        oddsSnapshot: leg.oddsSnapshot ? Number(leg.oddsSnapshot) : null,
        signalScore: Number(leg.signalScore),
        isCorrect: leg.isCorrect,
        modelRunId: leg.fixture.modelRuns[0]?.id ?? null,
      })),
    }));
  }

  async recordView(couponProposalId: string, userId: string): Promise<void> {
    if (!(await this.repo.exists(couponProposalId))) {
      throw new NotFoundException('Coupon introuvable');
    }
    await this.repo.recordView(couponProposalId, userId);
  }
}

function formatFixtureScore(scores: {
  homeScore: number | null;
  awayScore: number | null;
}): string | null {
  const { homeScore, awayScore } = scores;
  return homeScore === null || awayScore === null
    ? null
    : `${homeScore}-${awayScore}`;
}
