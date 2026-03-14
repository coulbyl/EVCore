import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { BetStatus, CouponStatus } from '@evcore/db';
import Decimal from 'decimal.js';
import { createLogger } from '@utils/logger';
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
  COUPON_WINDOW_MAX_DAYS,
  COUPON_WINDOW_MIN_DAYS,
} from '@config/coupon.constants';
import { tomorrowUtc } from '@utils/date.utils';
import { CouponRepository } from './coupon.repository';

const logger = createLogger('coupon-service');

type CouponWindowInput = {
  startDate: Date;
  days?: number;
};

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
    return this.generateCouponWindow({ startDate: date, days: 1 });
  }

  async generateCouponWindow(input: CouponWindowInput): Promise<void> {
    const days = input.days ?? 1;
    if (
      !Number.isInteger(days) ||
      days < COUPON_WINDOW_MIN_DAYS ||
      days > COUPON_WINDOW_MAX_DAYS
    ) {
      throw new Error(
        `Coupon window days must be an integer between ${COUPON_WINDOW_MIN_DAYS} and ${COUPON_WINDOW_MAX_DAYS}`,
      );
    }

    const startDate = startOfUtcDay(input.startDate);
    const endDate = addUtcDays(startDate, days - 1);

    const fixtures =
      days === 1
        ? await this.fixtureService.findScheduledForDate(startDate)
        : await this.fixtureService.findScheduledInRange(startDate, endDate);

    if (fixtures.length === 0) {
      logger.info(
        {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          days,
        },
        'No scheduled fixtures — generating NO_BET coupon',
      );
      const coupon = await this.couponRepository.create({
        date: startDate,
        status: CouponStatus.NO_BET,
        legCount: 0,
      });
      await this.notificationService.sendNoBetToday(startDate);
      logger.info({ couponId: coupon.id }, 'NO_BET coupon created');
      return;
    }

    // Analyze all scheduled fixtures for the day and keep only bets generated
    // by this execution. A coupon is an autonomous betting opportunity and
    // must not mix in stale pending bets from previous runs on the same fixtures.
    const analyzed = await Promise.all(
      fixtures.map(({ id: fixtureId }) =>
        this.bettingEngineService.analyzeFixture(fixtureId),
      ),
    );
    const generatedBetIds = analyzed.flatMap((result) =>
      result.status === 'analyzed' && result.betId !== null
        ? [result.betId]
        : [],
    );

    if (generatedBetIds.length === 0) {
      const coupon = await this.couponRepository.create({
        date: startDate,
        status: CouponStatus.NO_BET,
        legCount: 0,
      });
      await this.notificationService.sendNoBetToday(startDate);
      logger.info(
        { couponId: coupon.id },
        'NO_BET coupon created — current analysis generated no bets',
      );
      return;
    }

    const bets = await this.prisma.client.bet.findMany({
      where: {
        id: { in: generatedBetIds },
        status: BetStatus.PENDING,
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
        date: startDate,
        status: CouponStatus.NO_BET,
        legCount: 0,
      });
      await this.notificationService.sendNoBetToday(startDate);
      logger.info(
        { couponId: coupon.id },
        'NO_BET coupon created — no picks passed EV threshold',
      );
      return;
    }

    const coupon = await this.couponRepository.create({
      date: startDate,
      status: CouponStatus.PENDING,
      legCount: selected.length,
    });

    await this.couponRepository.linkBets(
      coupon.id,
      selected.map((b) => b.id),
    );

    const fullBets = await this.prisma.client.bet.findMany({
      where: { id: { in: selected.map((b) => b.id) } },
      include: {
        modelRun: {
          select: {
            fixture: {
              select: {
                scheduledAt: true,
                homeTeam: { select: { name: true } },
                awayTeam: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    await this.notificationService.sendDailyCoupon({
      id: coupon.id,
      date: startDate,
      legCount: selected.length,
      bets: fullBets,
    });

    logger.info(
      { couponId: coupon.id, legCount: selected.length },
      'Daily coupon created',
    );
  }

  // Convenience method — generates coupon for tomorrow (used by tests / manual trigger).
  async generateForTomorrow(days = 1): Promise<void> {
    return this.generateCouponWindow({ startDate: tomorrowUtc(), days });
  }

  async settleExpiredCoupons(date: Date): Promise<{ settledCount: number }> {
    const cutoff = new Date(date);
    cutoff.setUTCHours(23, 59, 59, 999);
    const coupons = await this.couponRepository.findPendingCouponsUntil(cutoff);

    let settledCount = 0;
    for (const coupon of coupons) {
      const nextStatus = resolveCouponStatus(coupon.bets);
      if (nextStatus === null) continue;

      await this.couponRepository.updateStatus(coupon.id, nextStatus);
      await this.notificationService.sendCouponResult(coupon.id);
      settledCount++;
    }

    return { settledCount };
  }

  async settleCouponById(couponId: string): Promise<{
    couponId: string;
    status: CouponStatus;
    settled: boolean;
  }> {
    const coupon = await this.couponRepository.findCouponById(couponId);
    if (!coupon) {
      throw new Error(`Coupon not found: ${couponId}`);
    }

    const nextStatus = resolveCouponStatus(coupon.bets);
    if (nextStatus === null) {
      return { couponId, status: coupon.status, settled: false };
    }

    await this.couponRepository.updateStatus(couponId, nextStatus);
    await this.notificationService.sendCouponResult(couponId);
    return { couponId, status: nextStatus, settled: true };
  }

  async getCouponById(couponId: string) {
    return this.couponRepository.findCouponById(couponId);
  }
}

function startOfUtcDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function addUtcDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(23, 59, 59, 999);
  return value;
}

function resolveCouponStatus(
  bets: { status: BetStatus }[],
): CouponStatus | null {
  if (bets.length === 0) return CouponStatus.NO_BET;
  if (bets.some((bet) => bet.status === BetStatus.PENDING)) return null;
  if (bets.some((bet) => bet.status === BetStatus.LOST))
    return CouponStatus.LOST;
  if (bets.every((bet) => bet.status === BetStatus.WON))
    return CouponStatus.WON;
  return CouponStatus.SETTLED;
}
