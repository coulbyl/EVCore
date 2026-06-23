import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CouponProposalStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { CouponRepository } from './coupon.repository';
import { SignalWindowService } from './signal-window.service';
import {
  CouponComposerService,
  recommendedCouponStakePct,
} from './coupon-composer.service';
import {
  COUPON_PARAMS,
  resolveCouponProfile,
  type CouponProfileName,
} from './coupon.constants';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';

const logger = createLogger('coupon');

@Injectable()
export class CouponService {
  private readonly kellyEnabled: boolean;
  private readonly combosEnabled: boolean;
  private readonly stakeDraw: boolean;
  private readonly enforceAvoid: boolean;

  // eslint-disable-next-line max-params -- Explicit NestJS service injection.
  constructor(
    private readonly repo: CouponRepository,
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
    config: ConfigService,
  ) {
    this.kellyEnabled = config.get<string>('KELLY_ENABLED', 'false') === 'true';
    // Same-match combos (Étape 6) — off by default until backtested per league.
    this.combosEnabled =
      config.get<string>('COUPON_COMBOS_ENABLED', 'false') === 'true';
    // DRAW staking (B7) — on by default: backtested +9.9% ROI, product-approved.
    // Kept env-toggleable (COUPON_STAKE_DRAW=false) as a kill-switch.
    this.stakeDraw =
      config.get<string>('COUPON_STAKE_DRAW', 'true') !== 'false';
    // AVOID enforcement — on by default: drops staking picks whose model↔market
    // divergence is implausible (≥ AVOID_CONFIG.maxEdge); validated -20% ROI on
    // those picks over 3 seasons. Kill-switch: COUPON_ENFORCE_AVOID=false.
    this.enforceAvoid =
      config.get<string>('COUPON_ENFORCE_AVOID', 'true') !== 'false';
  }

  async generateCoupons(
    date: string,
    opts: { windowDays?: number; profile?: CouponProfileName } = {},
  ): Promise<void> {
    const { windowDays = COUPON_PARAMS.windowDays, profile } = opts;
    // Profil indicatif optionnel ; défaut = bornes backtestées (pas de régression,
    // multi-profil non activé tant que la gate de backtest n'est pas verte).
    const profileBounds = resolveCouponProfile(profile);
    logger.info(
      { date, windowDays, profile: profile ?? 'DEFAULT' },
      'Generating coupons',
    );

    const asOf = new Date(`${date}T00:00:00.000Z`);
    await this.repo.deletePendingForDate(asOf);

    const [window, rawPicks] = await Promise.all([
      this.signalWindow.computeSignalWindow(windowDays, asOf),
      this.signalWindow.getTodayPool(date, {
        includeCombos: this.combosEnabled,
        includeDraw: this.stakeDraw,
        enforceAvoid: this.enforceAvoid,
      }),
    ]);

    const distinctFixtures = new Set(rawPicks.map((p) => p.fixtureId)).size;
    logger.info(
      { date, picks: rawPicks.length, distinctFixtures },
      'Pool loaded',
    );

    const scoredPicks = this.composer.scorePicks(rawPicks, window, date);
    const coupons = this.composer.compose(scoredPicks, profileBounds);

    if (coupons.length === 0) {
      logger.info(
        { date, picks: rawPicks.length, distinctFixtures },
        'No viable coupons generated',
      );
      return;
    }

    for (const coupon of coupons) {
      const lastScheduledAt = coupon.legs
        .map((leg) => leg.scheduledAt)
        .reduce((a, b) => (a > b ? a : b));

      // Mise recommandée (% bankroll) — Kelly fractionnaire derrière KELLY_ENABLED,
      // mise plate sinon. Tracée dans le reasoning (pas de colonne dédiée).
      const recommendedStakePct = recommendedCouponStakePct(
        coupon,
        this.kellyEnabled,
      );

      await this.repo.upsertProposal({
        forDate: new Date(`${date}T00:00:00.000Z`),
        rank: coupon.rank,
        signalWindowDays: windowDays,
        targetOddsMin: 1.0,
        targetOddsMax: COUPON_PARAMS.maxCombinedOdds,
        combinedOdds: coupon.combinedOdds,
        jointProbability: coupon.jointProbability,
        signalScore: coupon.signalScore,
        lastFixtureScheduledAt: lastScheduledAt,
        reasoning: {
          ...coupon.reasoning,
          recommendedStakePct,
          stakingMode: this.kellyEnabled ? 'KELLY' : 'FLAT',
        },
        legs: coupon.legs.map((leg) => ({
          fixtureId: leg.fixtureId,
          canal: leg.canal,
          market: leg.market,
          pick: leg.pick,
          comboMarket: leg.comboMarket,
          comboPick: leg.comboPick,
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
        country: leg.fixture.season.competition.country,
        scheduledAt: leg.fixture.scheduledAt.toISOString(),
        canal: leg.canal,
        market: leg.market,
        pick: leg.pick,
        comboMarket: leg.comboMarket ?? null,
        comboPick: leg.comboPick ?? null,
        probability: Number(leg.probability),
        oddsSnapshot: leg.oddsSnapshot ? Number(leg.oddsSnapshot) : null,
        signalScore: Number(leg.signalScore),
        isCorrect: leg.isCorrect,
      })),
    }));
  }
}
