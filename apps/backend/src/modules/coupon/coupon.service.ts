import { Injectable } from '@nestjs/common';
import { CouponProposalStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { CouponRepository } from './coupon.repository';
import { SignalWindowService } from './signal-window.service';
import { CouponComposerService } from './coupon-composer.service';
import {
  COUPON_CLASSES,
  COUPON_PARAMS,
  LEGACY_LONGSHOT_MIN_ODDS,
  classForTargetOddsMin,
  type CouponClass,
} from './coupon.constants';
import { DEFAULT_STAKE_PCT } from '@modules/betting-engine/ev.constants';
import type { CouponProposalDto } from './dto/coupon-proposal.dto';
import type { ScoredPick } from './signal-window.service';

const logger = createLogger('coupon');

@Injectable()
export class CouponService {
  // DRAW/TEAM_TOTAL/BTTS staking, AVOID enforcement, evaluated-markets pool
  // widening — all default-on, no env kill-switch. Project philosophy: ship
  // as the real default behaviour and observe/iterate on real results,
  // rather than gate behind a flag nobody has bandwidth to actively manage
  // (2026-08-16 — a dormant COUPON_INCLUDE_EVALUATED_MARKETS flag would have
  // repeated the exact "surface not depth" problem this feature fixes).
  //
  // - DRAW: backtested +9.9% ROI, product-approved (B7).
  // - TEAM_TOTAL / BTTS: no longer reach the pool at all since 2026-08-22 —
  //   both fall under the calibration-ratio bar in POOL_ELIGIBLE_CHANNELS
  //   (0.830 and 0.893), so their staking flags gated nothing and were
  //   removed. Their per-league ROI backtests stay valid; what disqualifies
  //   them is the multiplicative probability bias they inject into a parlay.
  // - AVOID: drops picks whose model↔market divergence is implausible
  //   (≥ AVOID_CONFIG.maxEdge) — validated -20% ROI on those picks over 3
  //   seasons.
  // - FADE regime (stake the opposite pick on extreme-divergence-alone):
  //   backtested +18%/+20% ROI train/valid (2026-08-09,
  //   backtest-coupon-quality-signals) but n=15-17 barely clears MIN_SAMPLE —
  //   let it live and revisit once more settled data accumulates, rather than
  //   leave it dormant behind a flag.
  // - Evaluated-markets widening: briefly reverted 2026-08-19 on the theory
  //   that canal=VALUE evaluated-only legs carry no real signal
  //   (db:backtest:coupon-value-leg-shrinkage-calibration: shrink factor
  //   0.00) — but turning it off collapses coupon VOLUME/day-coverage far
  //   more than it improves ROI once actually re-tested with a working
  //   backtest tool (2026-08-20: a separate upsertProposal bug had silently
  //   no-op'd every prior "validation" regeneration, see
  //   deleteExpiredInRange, coupon.repository.ts). With it OFF: 87 settled
  //   coupons over 65/384 days. With it ON (this setting): 371 over 178
  //   days, and a LESS negative ROI (-9.06% vs -15.79% to -29% across every
  //   configuration tried that night). Left ON — the coupon composer's ROI
  //   is negative in every configuration tested so far, on or off; this
  //   flag isn't the fix, just the one that keeps more days generating at
  //   all. See EVALUATED_MARKET_CANAL doc (coupon.constants.ts).
  //   'viable' evaluatedPicks pass the same probability/EV/odds/suspension
  //   gates as officially-staked picks — losing their own channel's internal
  //   arbitration isn't a reliability rejection.
  private readonly stakeDraw = true;
  private readonly enforceAvoid = true;
  private readonly enableAvoidFade = true;
  private readonly includeEvaluatedMarkets = true;

  constructor(
    private readonly repo: CouponRepository,
    private readonly signalWindow: SignalWindowService,
    private readonly composer: CouponComposerService,
  ) {}

  async generateCoupons(
    date: string,
    opts: {
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
    const { to = date } = opts;
    logger.info({ date, to }, 'Generating coupons');

    const asOf = new Date(`${date}T00:00:00.000Z`);
    for (const couponClass of COUPON_CLASSES) {
      await this.repo.deletePendingForDate(
        asOf,
        couponClass.targetOddsMin,
        couponClass.targetOddsMax,
      );
    }

    const [window, rawPicks] = await Promise.all([
      this.signalWindow.computeLegCalibration(asOf),
      this.signalWindow.getPoolForRange(date, to, {
        includeDraw: this.stakeDraw,
        enforceAvoid: this.enforceAvoid,
        enableAvoidFade: this.enableAvoidFade,
        includeEvaluatedMarkets: this.includeEvaluatedMarkets,
      }),
    ]);

    const distinctFixtures = new Set(rawPicks.map((p) => p.fixtureId)).size;
    logger.info(
      { date, picks: rawPicks.length, distinctFixtures },
      'Pool loaded',
    );

    const scoredPicks = this.composer.scorePicks(rawPicks, window);

    // Une passe par classe. Les classes partagent le même vivier et peuvent
    // donc proposer le même match : c'est voulu, un utilisateur n'en joue
    // qu'une. La disjonction stricte n'a de sens qu'À L'INTÉRIEUR d'une
    // classe, où les coupons sont proposés ensemble.
    let total = 0;
    for (const couponClass of COUPON_CLASSES) {
      total += await this.generateForClass({
        date,
        couponClass,
        scoredPicks,
      });
    }

    logger.info(
      { date, count: total, picks: rawPicks.length, distinctFixtures },
      total === 0 ? 'No viable coupons generated' : 'Coupons upserted',
    );
  }

  private async generateForClass(args: {
    date: string;
    couponClass: CouponClass;
    scoredPicks: ScoredPick[];
  }): Promise<number> {
    const { date, couponClass, scoredPicks } = args;
    const coupons = this.composer.compose(scoredPicks, {
      targetCombinedOdds: couponClass.targetCombinedOdds,
    });

    for (const coupon of coupons) {
      const lastScheduledAt = coupon.legs
        .map((leg) => leg.scheduledAt)
        .reduce((a, b) => (a > b ? a : b));

      // Mise recommandée (% bankroll) — toujours plate (pas de Kelly : le
      // sizing Kelly amplifierait l'edge annoncé, donc aussi le biais de
      // surconfiance du modèle). Tracée dans le reasoning (pas de colonne
      // dédiée).
      const recommendedStakePct = DEFAULT_STAKE_PCT.toNumber();

      await this.repo.upsertProposal({
        forDate: new Date(`${date}T00:00:00.000Z`),
        rank: coupon.rank,
        signalWindowDays: COUPON_PARAMS.legacySignalWindowDays,
        // Porte la CLASSE : c'est ce qui permet aux trois de coexister sur une
        // même date sous la contrainte unique
        // (forDate, signalWindowDays, targetOddsMin, targetOddsMax, rank)
        // au lieu de s'écraser l'une l'autre. Sert aussi de discriminant de
        // classe à la lecture, sans colonne supplémentaire ni migration.
        targetOddsMin: couponClass.targetOddsMin,
        targetOddsMax: couponClass.targetOddsMax,
        combinedOdds: coupon.combinedOdds,
        jointProbability: coupon.jointProbability,
        signalScore: coupon.signalScore,
        lastFixtureScheduledAt: lastScheduledAt,
        reasoning: {
          ...coupon.reasoning,
          recommendedStakePct,
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

    return coupons.length;
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
      // Le badge "Expérimental" marquait les coupons LONGSHOT. Ces profils
      // n'existent plus (COUPON_BOUNDS) ; les lignes historiques gardent leur
      // targetOddsMin élevé, on continue donc de les marquer telles quelles.
      experimental: Number(p.targetOddsMin) >= LEGACY_LONGSHOT_MIN_ODDS,
      couponClass: classForTargetOddsMin(Number(p.targetOddsMin)),
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
