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
  COUPON_PROFILES,
  resolveCouponProfile,
  type CouponProfileName,
} from './coupon.constants';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';

const logger = createLogger('coupon');

@Injectable()
export class CouponService {
  private readonly kellyEnabled: boolean;
  private readonly stakeDraw: boolean;
  private readonly stakeTeamTotal: boolean;
  private readonly stakeBtts: boolean;
  private readonly enforceAvoid: boolean;
  private readonly enableAvoidFade: boolean;

  // eslint-disable-next-line max-params -- Explicit NestJS service injection.
  constructor(
    private readonly repo: CouponRepository,
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
    config: ConfigService,
  ) {
    this.kellyEnabled = config.get<string>('KELLY_ENABLED', 'false') === 'true';
    // DRAW staking (B7) — on by default: backtested +9.9% ROI, product-approved.
    // Kept env-toggleable (COUPON_STAKE_DRAW=false) as a kill-switch.
    this.stakeDraw =
      config.get<string>('COUPON_STAKE_DRAW', 'true') !== 'false';
    // TEAM_TOTAL staking (B7 promotion, 2026-07-28) — backtested +3.40% ROI
    // (n=845, all leagues). Kill-switch: COUPON_STAKE_TEAM_TOTAL=false.
    this.stakeTeamTotal =
      config.get<string>('COUPON_STAKE_TEAM_TOTAL', 'true') !== 'false';
    // BTTS staking (B7 promotion, 2026-07-28) — restricted to
    // BTTS_STAKED_LEAGUES inside getTodayPool (per-league split shows a real
    // edge/loss divide, not a uniform +0.76%). Kill-switch: COUPON_STAKE_BTTS=false.
    this.stakeBtts =
      config.get<string>('COUPON_STAKE_BTTS', 'true') !== 'false';
    // AVOID enforcement — on by default: drops staking picks whose model↔market
    // divergence is implausible (≥ AVOID_CONFIG.maxEdge); validated -20% ROI on
    // those picks over 3 seasons. Kill-switch: COUPON_ENFORCE_AVOID=false.
    this.enforceAvoid =
      config.get<string>('COUPON_ENFORCE_AVOID', 'true') !== 'false';
    // FADE regime (stake the opposite pick on extreme-divergence-alone) —
    // backtested +18%/+20% ROI train/valid (2026-08-09,
    // backtest-coupon-quality-signals), but n=15-17 barely clears the
    // MIN_SAMPLE floor — off by default until more settled data confirms it.
    this.enableAvoidFade =
      config.get<string>('COUPON_ENFORCE_AVOID_FADE', 'false') === 'true';
  }

  async generateCoupons(
    date: string,
    opts: {
      windowDays?: number;
      profile?: CouponProfileName;
      /**
       * Last day (inclusive) of a multi-day fixture window — e.g. `date`
       * Friday, `to` Sunday for a weekend coupon, or `date` Tuesday, `to`
       * Thursday for a midweek European-nights coupon. Defaults to `date`
       * (single day, unchanged behaviour). `forDate` in the persisted
       * proposal stays keyed on `date` (the generation day) regardless —
       * only the fixture pool widens; each leg keeps its own `scheduledAt`.
       */
      to?: string;
    } = {},
  ): Promise<void> {
    const { windowDays = COUPON_PARAMS.windowDays, profile, to = date } = opts;
    // Profil indicatif optionnel ; défaut = bornes backtestées (pas de régression,
    // multi-profil non activé tant que la gate de backtest n'est pas verte).
    const profileBounds = resolveCouponProfile(profile);
    logger.info(
      { date, to, windowDays, profile: profile ?? 'DEFAULT' },
      'Generating coupons',
    );

    const asOf = new Date(`${date}T00:00:00.000Z`);
    await this.repo.deletePendingForDate(
      asOf,
      profileBounds.minCombinedOdds,
      profileBounds.maxCombinedOdds,
    );

    const [window, rawPicks] = await Promise.all([
      this.signalWindow.computeSignalWindow(windowDays, asOf),
      this.signalWindow.getPoolForRange(date, to, {
        includeDraw: this.stakeDraw,
        includeTeamTotal: this.stakeTeamTotal,
        includeBtts: this.stakeBtts,
        enforceAvoid: this.enforceAvoid,
        enableAvoidFade: this.enableAvoidFade,
      }),
    ]);

    const distinctFixtures = new Set(rawPicks.map((p) => p.fixtureId)).size;
    logger.info(
      { date, picks: rawPicks.length, distinctFixtures },
      'Pool loaded',
    );

    const scoredPicks = this.composer.scorePicks(rawPicks, window);
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
        // Reflects the PROFILE actually used, not a hardcoded default — two
        // profiles generated for the same date/windowDays must land on
        // distinct rows under the forDate_signalWindowDays_targetOddsMin_
        // targetOddsMax_rank unique constraint, not silently upsert into
        // each other. For the (unnamed) default profile this is numerically
        // identical to the previous hardcoded 1.0/maxCombinedOdds, so no
        // change for existing live generation.
        targetOddsMin: profileBounds.minCombinedOdds,
        targetOddsMax: profileBounds.maxCombinedOdds,
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
      experimental:
        Number(p.targetOddsMin) >=
        COUPON_PROFILES.LONGSHOT_WEEKEND.minCombinedOdds,
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
      })),
    }));
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
