import { Injectable } from '@nestjs/common';
import { CouponProposalStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { AiEngineRepository } from './ai-engine.repository';
import { SignalWindowService } from './signal-window.service';
import { CouponComposerService } from './coupon-composer.service';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';

const logger = createLogger('ai-engine');

const DEFAULT_WINDOW_DAYS = 14;
const DEFAULT_ODDS_MIN = 2.5;
const DEFAULT_ODDS_MAX = 50;

@Injectable()
export class AiEngineService {
  constructor(
    private readonly repo: AiEngineRepository,
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
  ) {}

  async generateCoupons(
    date: string,
    opts: { windowDays?: number; oddsMin?: number; oddsMax?: number } = {},
  ): Promise<void> {
    const {
      windowDays = DEFAULT_WINDOW_DAYS,
      oddsMin = DEFAULT_ODDS_MIN,
      oddsMax = DEFAULT_ODDS_MAX,
    } = opts;
    logger.info({ date, windowDays, oddsMin, oddsMax }, 'Generating coupons');

    await this.repo.deletePendingForDate(new Date(`${date}T00:00:00.000Z`));

    const [window, rawPicks] = await Promise.all([
      this.signalWindow.computeSignalWindow(windowDays),
      this.signalWindow.getTodayPool(date),
    ]);

    const scoredPicks = this.composer.scorePicks(rawPicks, window, date);
    const coupons = this.composer.compose(scoredPicks, oddsMin, oddsMax);

    if (coupons.length === 0) {
      logger.info({ date }, 'No viable coupons generated');
      return;
    }

    for (const coupon of coupons) {
      const lastScheduledAt = coupon.legs
        .map((leg) => leg.scheduledAt)
        .reduce((a, b) => (a > b ? a : b));

      await this.repo.upsertProposal({
        forDate: new Date(`${date}T00:00:00.000Z`),
        rank: coupon.rank,
        signalWindowDays: windowDays,
        targetOddsMin: oddsMin,
        targetOddsMax: oddsMax,
        combinedOdds: coupon.combinedOdds,
        jointProbability: coupon.jointProbability,
        signalScore: coupon.signalScore,
        lastFixtureScheduledAt: lastScheduledAt,
        reasoning: coupon.reasoning,
        legs: coupon.legs.map((leg) => ({
          fixtureId: leg.fixtureId,
          canal: leg.canal,
          market: leg.market,
          pick: leg.pick,
          probability: leg.probability,
          oddsSnapshot: leg.oddsSnapshot,
          signalScore: leg.signalScore,
          featureSnapshot: leg.featureSnapshot,
        })),
      });
    }

    logger.info({ date, count: coupons.length }, 'Coupons upserted');
  }

  async getCoupons(
    date: string,
    status?: CouponProposalStatus,
  ): Promise<CouponProposalDto[]> {
    const forDate = new Date(`${date}T00:00:00.000Z`);
    const proposals = await this.repo.findByDate(forDate, status);

    return proposals.map((p) => ({
      id: p.id,
      forDate: p.forDate.toISOString().slice(0, 10),
      rank: p.rank,
      signalWindowDays: p.signalWindowDays,
      targetOddsMin: Number(p.targetOddsMin),
      targetOddsMax: Number(p.targetOddsMax),
      combinedOdds: Number(p.combinedOdds),
      jointProbability: Number(p.jointProbability),
      signalScore: Number(p.signalScore),
      status: p.status,
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
        scheduledAt: leg.fixture.scheduledAt.toISOString(),
        canal: leg.canal,
        market: leg.market,
        pick: leg.pick,
        probability: Number(leg.probability),
        oddsSnapshot: leg.oddsSnapshot ? Number(leg.oddsSnapshot) : null,
        signalScore: Number(leg.signalScore),
        isCorrect: leg.isCorrect,
      })),
    }));
  }
}
