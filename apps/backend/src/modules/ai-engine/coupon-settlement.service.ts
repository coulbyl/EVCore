import { Injectable } from '@nestjs/common';
import { BetStatus, CouponResult, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import {
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
} from '../betting-engine/betting-engine.utils';
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

  let status: BetStatus;
  if (market === Market.HALF_TIME_FULL_TIME) {
    status = resolveHalfTimeFullTimeBetStatus({
      pick,
      homeHtScore,
      awayHtScore,
      homeScore,
      awayScore,
    });
  } else if (
    market === Market.OVER_UNDER_HT ||
    market === Market.FIRST_HALF_WINNER
  ) {
    status = resolveFirstHalfBetStatus(pick, homeHtScore, awayHtScore);
  } else {
    status = resolvePickBetStatus(pick, homeScore, awayScore);
  }

  if (status === BetStatus.WON) return true;
  if (status === BetStatus.LOST) return false;
  return null; // VOID — scores not yet available or unknown pick
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

    // Early-fail: a coupon is LOST as soon as any leg loses — no need to wait
    // for all legs to be resolved. Coupon combinatorics mean one loss = full loss.
    const anyLost = legResults.some((r) => !r);
    if (anyLost) {
      await this.repo.updateResult(proposalId, CouponResult.LOST);
      logger.info(
        {
          proposalId,
          result: CouponResult.LOST,
          resolvedLegs: legResults.length,
        },
        'Proposal early-failed: at least one leg lost',
      );
      return;
    }

    if (!allResolved) {
      logger.info(
        { proposalId, resolvedLegs: legResults.length },
        'Proposal not fully resolved yet — retry later',
      );
      return;
    }

    const correct = legResults.filter(Boolean).length;
    const result: CouponResult =
      correct === legResults.length ? CouponResult.WON : CouponResult.PARTIAL;

    await this.repo.updateResult(proposalId, result);
    logger.info(
      { proposalId, result, correct, total: legResults.length },
      'Proposal settled',
    );
  }
}
