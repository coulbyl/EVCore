import { Injectable } from '@nestjs/common';
import { BetStatus, CouponResult, FixtureStatus, Market } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import {
  resolveFirstHalfBetStatus,
  resolveHalfTimeFullTimeBetStatus,
  resolvePickBetStatus,
  resolveWinEitherHalfBetStatus,
} from '../betting-engine/betting-engine.utils';
import { CouponRepository } from './coupon.repository';
import { createLogger } from '@utils/logger';
import { productDecimal, type DecimalLike } from '@utils/decimal.utils';

const logger = createLogger('coupon-settlement');

type MatchScores = {
  homeScore: number;
  awayScore: number;
  homeHtScore: number | null;
  awayHtScore: number | null;
};

/**
 * Trois issues, pas deux.
 *
 * `VOID` (mise remboursée) et `UNRESOLVED` (score pas encore exploitable)
 * étaient tous deux rendus par `null`, et l'appelant traitait `null` comme
 * « pas encore résolu ». Conséquence : une jambe DRAW_NO_BET sur un match nul
 * — un remboursement, cas parfaitement normal — bloquait le coupon
 * indéfiniment. Constaté en production le 2026-08-22 : des coupons affichant
 * « Terminé » sur la jambe et jamais réglés.
 *
 * Un VOID doit sortir de la combinatoire exactement comme un match reporté :
 * la jambe ne compte ni en gain ni en perte, sa cote ne gonfle pas le
 * paiement, et le coupon se règle sur les jambes restantes.
 */
type LegOutcome = boolean | 'VOID' | 'UNRESOLVED';

function resolveIsCorrect(
  market: Market,
  pick: string,
  scores: MatchScores,
): LegOutcome {
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
  } else if (market === Market.TO_WIN_EITHER_HALF) {
    status = resolveWinEitherHalfBetStatus(
      pick,
      homeHtScore,
      awayHtScore,
      homeScore,
      awayScore,
    );
  } else {
    status = resolvePickBetStatus(market, pick, homeScore, awayScore);
  }

  if (status === BetStatus.WON) return true;
  if (status === BetStatus.LOST) return false;
  if (status === BetStatus.VOID) return 'VOID';
  return 'UNRESOLVED';
}

@Injectable()
export class CouponSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CouponRepository,
  ) {}

  async settleReadyProposals(): Promise<void> {
    const ready = await this.repo.findPendingReadyToSettle(new Date());
    if (ready.length === 0) return;

    logger.info({ count: ready.length }, 'Settling coupon proposals');

    await Promise.all(ready.map((p) => this.settleProposal(p.id)));
  }

  /** Force re-settlement of every proposal (any status) in a `forDate` range —
   * catch-up for proposals already EXPIRED with a stale/wrong result. */
  async settleRange(from: Date, to: Date): Promise<{ resettled: number }> {
    const ids = await this.repo.findIdsInRange(from, to);
    logger.info(
      { count: ids.length, from, to },
      'Force re-settling coupon proposals in range',
    );
    await Promise.all(ids.map((id) => this.settleProposal(id)));
    return { resettled: ids.length };
  }

  async settleProposal(proposalId: string): Promise<void> {
    const proposal = await this.repo.findByIdWithLegs(proposalId);
    if (!proposal) return;

    const fixtureIds = [...new Set(proposal.legs.map((l) => l.fixtureId))];

    const fixtures = await this.prisma.client.fixture.findMany({
      where: { id: { in: fixtureIds } },
      select: {
        id: true,
        status: true,
        homeScore: true,
        awayScore: true,
        homeHtScore: true,
        awayHtScore: true,
      },
    });

    const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));

    let allResolved = true;
    let voidedLegs = 0;
    const legResults: boolean[] = [];
    // Odds of every non-voided leg — the cote réellement payable au
    // settlement (a voided leg never enters the combinatorics, so its odds
    // must never inflate the payout either).
    const survivingOdds: DecimalLike[] = [];

    for (const leg of proposal.legs) {
      const fixture = fixtureMap.get(leg.fixtureId);
      if (!fixture) {
        allResolved = false;
        continue;
      }

      // A postponed/cancelled fixture will never reach FINISHED — waiting on
      // it would retry forever (confirmed real: 45 POSTPONED + 96 CANCELLED
      // fixtures in this DB). Standard betting treatment: void this leg,
      // dropping it from the win/loss combinatorics instead of blocking the
      // whole coupon on a match that's never going to produce a score.
      if (
        fixture.status === FixtureStatus.POSTPONED ||
        fixture.status === FixtureStatus.CANCELLED
      ) {
        // Unlike the resolved-leg case below, `isCorrect === null` can't
        // distinguish "never settled" from "already voided" — always write
        // rather than skip, so a freshly-voided leg's settledAt actually gets set.
        await this.repo.settleLeg(leg.id, null);
        voidedLegs++;
        continue;
      }

      // HT markets only need half-time scores — don't wait for full-time
      const isHtMarket =
        leg.market === Market.OVER_UNDER_HT ||
        leg.market === Market.FIRST_HALF_WINNER;
      const hasHtScores =
        fixture.homeHtScore !== null && fixture.awayHtScore !== null;
      // FT markets must wait for the fixture to be definitively FINISHED —
      // homeScore/awayScore can be populated mid-match by live sync and are
      // not authoritative until the match is actually over.
      const hasFtScores =
        fixture.status === FixtureStatus.FINISHED &&
        fixture.homeScore !== null &&
        fixture.awayScore !== null;

      if (isHtMarket && !hasHtScores) {
        allResolved = false;
        continue;
      }
      if (!isHtMarket && !hasFtScores) {
        allResolved = false;
        continue;
      }

      const scores = {
        homeScore: fixture.homeScore ?? 0,
        awayScore: fixture.awayScore ?? 0,
        homeHtScore: fixture.homeHtScore,
        awayHtScore: fixture.awayHtScore,
      };
      const outcome = resolveIsCorrect(leg.market, leg.pick, scores);

      if (outcome === 'UNRESOLVED') {
        allResolved = false;
        continue;
      }

      // Remboursement (DRAW_NO_BET sur un nul, WIN_TO_NIL voidé, …) : même
      // traitement qu'un match reporté — hors combinatoire, hors cote payable.
      if (outcome === 'VOID') {
        await this.repo.settleLeg(leg.id, null);
        voidedLegs++;
        continue;
      }

      // La cote n'entre dans le paiement qu'une fois la jambe réellement
      // gradée : la pousser avant de connaître l'issue faisait compter une
      // jambe remboursée dans `realizedOdds`.
      if (leg.oddsSnapshot !== null) {
        survivingOdds.push(leg.oddsSnapshot);
      }

      const isCorrect = outcome;

      // Always recompute (never trust a previously stored isCorrect) so a leg
      // settled from a stale in-progress score before FINISHED self-corrects
      // here, mirroring BetSettlementService.settleOpenBets. Only write when
      // the value actually changed, to avoid needless settledAt churn.
      if (leg.isCorrect !== isCorrect) {
        await this.repo.settleLeg(leg.id, isCorrect);
      }
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

    // Every leg voided (postponed/cancelled) — nothing left to grade.
    if (legResults.length === 0) {
      await this.repo.updateResult(proposalId, CouponResult.VOID);
      logger.info(
        { proposalId, result: CouponResult.VOID, voidedLegs },
        'Proposal voided: every leg postponed/cancelled',
      );
      return;
    }

    const correct = legResults.filter(Boolean).length;
    // correct === legResults.length always holds here (anyLost already
    // returned above otherwise) — PARTIAL marks a coupon that won on every
    // graded leg but had at least one leg voided along the way, so it reads
    // differently from a clean WON rather than being silently indistinguishable.
    const result: CouponResult =
      correct === legResults.length
        ? voidedLegs > 0
          ? CouponResult.PARTIAL
          : CouponResult.WON
        : CouponResult.PARTIAL;

    // Cote réellement payée : produit des cotes des jambes non-voidées
    // uniquement. Sur un WON sans void, égale à combinedOdds (toutes les
    // jambes ont survécu) ; sur un PARTIAL, strictement inférieure — sans ce
    // recalcul, le ROI agrégé surestimerait le gain réel du coupon.
    const realizedOdds = productDecimal(survivingOdds).toNumber();

    await this.repo.updateResult(proposalId, result, realizedOdds);
    logger.info(
      {
        proposalId,
        result,
        correct,
        total: legResults.length,
        voidedLegs,
        realizedOdds,
      },
      'Proposal settled',
    );
  }
}
