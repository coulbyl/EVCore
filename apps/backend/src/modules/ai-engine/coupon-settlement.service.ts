import { Injectable } from '@nestjs/common';
import { CouponResult, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { AiEngineRepository } from './ai-engine.repository';
import { createLogger } from '@utils/logger';

const logger = createLogger('coupon-settlement');

type MatchScores = {
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

function resolveIsCorrect(
  market: Market,
  pick: string,
  scores: MatchScores,
): boolean | null {
  const { homeScore, awayScore, homeHtScore, awayHtScore } = scores;
  switch (market) {
    case Market.ONE_X_TWO: {
      if (pick === 'HOME') return homeScore > awayScore;
      if (pick === 'DRAW') return homeScore === awayScore;
      if (pick === 'AWAY') return awayScore > homeScore;
      return null;
    }
    case Market.BTTS:
      if (pick === 'YES') return homeScore > 0 && awayScore > 0;
      if (pick === 'NO') return !(homeScore > 0 && awayScore > 0);
      return null;
    case Market.OVER_UNDER: {
      const total = homeScore + awayScore;
      if (pick === 'OVER') return total > 2.5;
      if (pick === 'UNDER') return total < 2.5;
      if (pick === 'OVER_1_5') return total > 1.5;
      if (pick === 'UNDER_1_5') return total < 1.5;
      if (pick === 'OVER_3_5') return total > 3.5;
      if (pick === 'UNDER_3_5') return total < 3.5;
      return null;
    }
    case Market.FIRST_HALF_WINNER: {
      if (homeHtScore === null || awayHtScore === null) return null;
      if (pick === 'HOME') return homeHtScore > awayHtScore;
      if (pick === 'DRAW') return homeHtScore === awayHtScore;
      if (pick === 'AWAY') return awayHtScore > homeHtScore;
      return null;
    }
    default:
      return null;
  }
}

@Injectable()
export class CouponSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AiEngineRepository,
  ) {}

  async settleReadyProposals(): Promise<void> {
    const ready = await this.repo.findPendingReadyToSettle(new Date());
    if (ready.length === 0) return;

    logger.info({ count: ready.length }, 'Settling coupon proposals');

    await Promise.all(ready.map((p) => this.settleProposal(p.id)));
  }

  async settleProposal(proposalId: string): Promise<void> {
    const proposal = await this.repo.findByIdWithLegs(proposalId);
    if (!proposal) return;

    // Collect all fixtureIds needed
    const fixtureIds = [...new Set(proposal.legs.map((l) => l.fixtureId))];

    const fixtures = await this.prisma.client.fixture.findMany({
      where: { id: { in: fixtureIds } },
      select: {
        id: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
      },
    });

    const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));

    let allResolved = true;
    const legResults: boolean[] = [];

    for (const leg of proposal.legs) {
      if (leg.isCorrect !== null) {
        legResults.push(leg.isCorrect);
        continue;
      }

      const fixture = fixtureMap.get(leg.fixtureId);
      if (
        !fixture ||
        fixture.homeScore === null ||
        fixture.awayScore === null
      ) {
        allResolved = false;
        continue;
      }

      const isCorrect = resolveIsCorrect(leg.market, leg.pick, {
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        homeHtScore: fixture.homeHtScore,
        awayHtScore: fixture.awayHtScore,
      });

      if (isCorrect === null) {
        allResolved = false;
        continue;
      }

      await this.repo.settleLeg(leg.id, isCorrect);
      legResults.push(isCorrect);
    }

    if (!allResolved) {
      logger.info(
        { proposalId },
        'Proposal not fully resolved yet — retry later',
      );
      return;
    }

    const correct = legResults.filter(Boolean).length;
    const result: CouponResult =
      correct === legResults.length
        ? CouponResult.WON
        : correct === 0
          ? CouponResult.LOST
          : CouponResult.PARTIAL;

    await this.repo.updateResult(proposalId, result);
    logger.info(
      { proposalId, result, correct, total: legResults.length },
      'Proposal settled',
    );
  }
}
