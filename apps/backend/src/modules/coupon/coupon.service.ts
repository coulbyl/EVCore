import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { BetStatus, CouponStatus } from '@evcore/db';
import Decimal from 'decimal.js';
import pino from 'pino';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { FixtureService } from '@modules/fixture/fixture.service';
import { NotificationService } from '@modules/notification/notification.service';
import { PrismaService } from '@/prisma.service';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
} from '@config/etl.constants';
import {
  COUPON_MAX_LEGS,
  COUPON_CRON_SCHEDULE,
  COUPON_SCHEDULER_KEY,
} from '@config/coupon.constants';
import { tomorrowUtc } from '@utils/date.utils';
import { CouponRepository } from './coupon.repository';

const logger = pino({ name: 'coupon-service' });

@Injectable()
export class CouponService implements OnApplicationBootstrap {
  private readonly schedulingEnabled: boolean;

  // eslint-disable-next-line max-params -- Explicit queue injection keeps queue wiring transparent.
  constructor(
    @InjectQueue(BULLMQ_QUEUES.BETTING_ENGINE)
    private readonly queue: Queue,
    private readonly couponRepository: CouponRepository,
    private readonly bettingEngineService: BettingEngineService,
    private readonly fixtureService: FixtureService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.schedulingEnabled =
      config.get<string>('COUPON_SCHEDULING_ENABLED', 'true') !== 'false';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.schedulingEnabled) {
      logger.info('Coupon scheduling disabled — skipping job scheduler setup');
      return;
    }

    await this.queue.upsertJobScheduler(
      COUPON_SCHEDULER_KEY,
      { pattern: COUPON_CRON_SCHEDULE },
      {
        name: 'generate-daily-coupon',
        data: {},
        opts: BULLMQ_DEFAULT_JOB_OPTIONS,
      },
    );

    logger.info({ cron: COUPON_CRON_SCHEDULE }, 'Coupon scheduler registered');
  }

  async generateDailyCoupon(date: Date): Promise<void> {
    // Guard idempotence — one coupon per calendar day.
    const existing = await this.couponRepository.findByDate(date);
    if (existing) {
      logger.info(
        { date: date.toISOString().slice(0, 10), couponId: existing.id },
        'Coupon already exists for this date — skipping',
      );
      return;
    }

    const fixtures = await this.fixtureService.findScheduledForDate(date);

    if (fixtures.length === 0) {
      logger.info(
        { date: date.toISOString().slice(0, 10) },
        'No scheduled fixtures — generating NO_BET coupon',
      );
      const coupon = await this.couponRepository.create({
        date,
        status: CouponStatus.NO_BET,
        legCount: 0,
      });
      await this.notificationService.sendNoBetToday(date);
      logger.info({ couponId: coupon.id }, 'NO_BET coupon created');
      return;
    }

    // Analyze all scheduled fixtures for the day.
    for (const { id: fixtureId } of fixtures) {
      await this.bettingEngineService.analyzeFixture(fixtureId);
    }

    // Collect PENDING bets linked to these fixtures via ModelRun.
    const fixtureIds = fixtures.map((f) => f.id);
    const bets = await this.prisma.client.bet.findMany({
      where: {
        status: BetStatus.PENDING,
        modelRun: { fixtureId: { in: fixtureIds } },
      },
      select: {
        id: true,
        ev: true,
        modelRun: {
          select: { deterministicScore: true, fixtureId: true },
        },
      },
    });

    // Compute qualityScore = ev × deterministicScore for each bet.
    type BetWithQuality = {
      id: string;
      fixtureId: string;
      qualityScore: Decimal;
    };

    const betsWithQuality: BetWithQuality[] = bets.map((b) => ({
      id: b.id,
      fixtureId: b.modelRun.fixtureId,
      qualityScore: new Decimal(b.ev.toString()).mul(
        b.modelRun.deterministicScore.toString(),
      ),
    }));

    // Anti-correlation: keep only the best bet per fixture.
    const bestByFixture = new Map<string, BetWithQuality>();
    for (const bet of betsWithQuality) {
      const current = bestByFixture.get(bet.fixtureId);
      if (!current || bet.qualityScore.greaterThan(current.qualityScore)) {
        bestByFixture.set(bet.fixtureId, bet);
      }
    }

    // Sort by qualityScore DESC and cap at COUPON_MAX_LEGS.
    const selected = Array.from(bestByFixture.values())
      .sort((a, b) => b.qualityScore.comparedTo(a.qualityScore))
      .slice(0, COUPON_MAX_LEGS);

    if (selected.length === 0) {
      const coupon = await this.couponRepository.create({
        date,
        status: CouponStatus.NO_BET,
        legCount: 0,
      });
      await this.notificationService.sendNoBetToday(date);
      logger.info(
        { couponId: coupon.id },
        'NO_BET coupon created — no picks passed EV threshold',
      );
      return;
    }

    const coupon = await this.couponRepository.create({
      date,
      status: CouponStatus.PENDING,
      legCount: selected.length,
    });

    await this.couponRepository.linkBets(
      coupon.id,
      selected.map((b) => b.id),
    );

    const fullBets = await this.prisma.client.bet.findMany({
      where: { id: { in: selected.map((b) => b.id) } },
    });

    await this.notificationService.sendDailyCoupon({
      id: coupon.id,
      date,
      legCount: selected.length,
      bets: fullBets,
    });

    logger.info(
      { couponId: coupon.id, legCount: selected.length },
      'Daily coupon created',
    );
  }

  // Convenience method — generates coupon for tomorrow (used by tests / manual trigger).
  async generateForTomorrow(): Promise<void> {
    return this.generateDailyCoupon(tomorrowUtc());
  }
}
