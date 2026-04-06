import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { BetStatus, CouponStatus, CouponTier } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { toNumber } from '@utils/prisma.utils';
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
  resolveCouponTier,
} from '@config/coupon.constants';
import { formatTimeUtc, tomorrowUtc } from '@utils/date.utils';
import {
  extractModelRunFeatureDiagnostics,
  type PickSnapshot,
  type EvaluatedPickSnapshot,
} from '@utils/model-run.utils';
import type { PredictionSource } from '@modules/betting-engine/betting-engine.types';
import { CouponRepository } from './coupon.repository';

const logger = createLogger('coupon-service');
type CouponWindowInput = {
  startDate: Date;
  days?: number;
};

type CouponSelectionSnapshot = {
  id: string;
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  scheduledAt: string;
  fixtureStatus: string;
  score: string | null;
  htScore: string | null;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID';
  market: string;
  pick: string;
  probEstimated: string;
  predictionSource: PredictionSource | null;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  odds: string;
  ev: string;
  candidatePicks: PickSnapshot[];
  evaluatedPicks: EvaluatedPickSnapshot[];
};

type CouponPeriodSnapshot = {
  id: string;
  code: string;
  status: 'PENDING' | 'WON' | 'LOST';
  tier: CouponTier | null;
  legs: number;
  ev: string;
  window: string;
  selections: CouponSelectionSnapshot[];
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

    // Fetch all scheduled fixtures for the window.
    const fixtures =
      days === 1
        ? await this.fixtureService.findScheduledForDate(startDate)
        : await this.fixtureService.findScheduledInRange(startDate, endDate);

    if (fixtures.length === 0) {
      logger.info(
        { startDate: startDate.toISOString().slice(0, 10), days },
        'No scheduled fixtures — skipping coupon generation',
      );
      await this.notificationService.sendNoBetToday(startDate);
      return;
    }

    // Pull all PENDING bets for those fixtures that are not yet in a PENDING coupon.
    // Sorted by qualityScore DESC (nulls last) then EV DESC — best picks first.
    const fixtureIds = fixtures.map((f) => f.id);
    const pool =
      await this.couponRepository.findEligibleBetsForCoupon(fixtureIds);

    if (pool.length === 0) {
      logger.info(
        { startDate: startDate.toISOString().slice(0, 10) },
        'No eligible bets in pool — skipping coupon generation',
      );
      await this.notificationService.sendNoBetToday(startDate);
      return;
    }

    // Split pool into chunks of COUPON_MAX_LEGS → one coupon per chunk.
    const chunks = chunkArray(pool, COUPON_MAX_LEGS);

    for (const chunk of chunks) {
      const betIds = chunk.map((b) => b.id);
      const avgQuality =
        chunk.reduce((sum, b) => sum + toNumber(b.qualityScore), 0) /
        chunk.length;
      const tier = resolveCouponTier(avgQuality);

      const coupon = await this.couponRepository.createCouponAndLinkBets({
        code: generateCouponCode(startDate),
        date: startDate,
        tier,
        betIds,
      });

      const fullBets = await this.prisma.client.bet.findMany({
        where: { id: { in: betIds } },
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
        legCount: betIds.length,
        tier,
        bets: fullBets,
      });

      logger.info(
        { couponId: coupon.id, legCount: betIds.length, tier },
        'Daily coupon created',
      );
    }
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

  async settlePendingCouponsByFixture(
    fixtureId: string,
  ): Promise<{ settledCount: number }> {
    const coupons =
      await this.couponRepository.findPendingCouponsByFixture(fixtureId);

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

  async getCouponById(couponId: string): Promise<CouponPeriodSnapshot | null> {
    const coupon = await this.couponRepository.findCouponById(couponId);
    if (!coupon) return null;
    return this.toCouponPeriodSnapshot(coupon, new Date());
  }

  async listCouponsByPeriod(input: {
    from?: string;
    to?: string;
    query?: string;
    status?: 'PENDING' | 'WON' | 'LOST';
    now?: Date;
  }): Promise<{
    period: { from: string; to: string };
    coupons: CouponPeriodSnapshot[];
  }> {
    const now = input.now ?? new Date();
    const defaultRange = currentUtcWeekRange(now);

    const fromDate = input.from
      ? startOfUtcDay(new Date(input.from))
      : defaultRange.from;
    const toDate = input.to ? endOfUtcDay(new Date(input.to)) : defaultRange.to;

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error('Invalid coupon period dates');
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error('Invalid coupon period: from must be <= to');
    }

    const coupons = await this.couponRepository.findCouponsByDateRange({
      from: fromDate,
      to: toDate,
      query: input.query,
      status: input.status,
    });

    return {
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      },
      coupons: coupons.map((coupon) =>
        this.toCouponPeriodSnapshot(coupon, now),
      ),
    };
  }

  private toCouponPeriodSnapshot(
    coupon: {
      id: string;
      code: string;
      date: Date;
      status: CouponStatus;
      tier?: CouponTier | null;
      bets: {
        id: string;
        market: string;
        pick: string;
        comboMarket: string | null;
        comboPick: string | null;
        probEstimated: unknown;
        oddsSnapshot: unknown;
        ev: unknown;
        status: BetStatus;
        modelRun: {
          features: unknown;
          fixture: {
            id: string;
            scheduledAt: Date;
            status: string;
            homeScore: number | null;
            awayScore: number | null;
            homeHtScore: number | null;
            awayHtScore: number | null;
            homeTeam: { name: string; logoUrl: string | null };
            awayTeam: { name: string; logoUrl: string | null };
          };
        };
      }[];
    },
    now: Date,
  ): CouponPeriodSnapshot {
    const avgEv =
      coupon.bets.length > 0
        ? coupon.bets.reduce((acc, bet) => acc + toNumber(bet.ev), 0) /
          coupon.bets.length
        : 0;

    return {
      id: coupon.id,
      code: coupon.code,
      status:
        coupon.status === 'WON' || coupon.status === 'LOST'
          ? coupon.status
          : 'PENDING',
      tier: coupon.tier ?? null,
      legs: coupon.bets.length,
      ev: formatSigned(avgEv, 2),
      window: couponWindow(coupon.date, now),
      selections: coupon.bets.map((bet) => {
        const diagnostics = extractModelRunFeatureDiagnostics(
          bet.modelRun.features,
        );
        const comboParts = [bet.pick];
        if (bet.comboMarket && bet.comboPick) {
          comboParts.push(`${bet.comboMarket} ${bet.comboPick}`);
        }
        return {
          id: bet.id,
          fixtureId: bet.modelRun.fixture.id,
          fixture: `${bet.modelRun.fixture.homeTeam.name} vs ${bet.modelRun.fixture.awayTeam.name}`,
          homeLogo: bet.modelRun.fixture.homeTeam.logoUrl ?? null,
          awayLogo: bet.modelRun.fixture.awayTeam.logoUrl ?? null,
          scheduledAt: formatTimeUtc(bet.modelRun.fixture.scheduledAt),
          fixtureStatus: bet.modelRun.fixture.status,
          score:
            bet.modelRun.fixture.homeScore !== null &&
            bet.modelRun.fixture.awayScore !== null
              ? `${bet.modelRun.fixture.homeScore} - ${bet.modelRun.fixture.awayScore}`
              : null,
          htScore:
            bet.modelRun.fixture.homeHtScore !== null &&
            bet.modelRun.fixture.awayHtScore !== null
              ? `${bet.modelRun.fixture.homeHtScore} - ${bet.modelRun.fixture.awayHtScore}`
              : null,
          status:
            bet.status === 'WON' ||
            bet.status === 'LOST' ||
            bet.status === 'VOID'
              ? bet.status
              : 'PENDING',
          market: bet.market,
          pick: comboParts.join(' + '),
          probEstimated: `${(toNumber(bet.probEstimated) * 100).toFixed(1)}%`,
          predictionSource: diagnostics.predictionSource,
          lambdaHome: diagnostics.lambdaHome,
          lambdaAway: diagnostics.lambdaAway,
          expectedTotalGoals: diagnostics.expectedTotalGoals,
          odds: toNumber(bet.oddsSnapshot).toFixed(2),
          ev: formatSigned(toNumber(bet.ev), 3),
          candidatePicks: diagnostics.candidatePicks,
          evaluatedPicks: diagnostics.evaluatedPicks,
        };
      }),
    };
  }
}

function startOfUtcDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function endOfUtcDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(23, 59, 59, 999);
  return value;
}

function addUtcDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(23, 59, 59, 999);
  return value;
}

function generateCouponCode(date: Date): string {
  const dateStr = date.toISOString().slice(0, 10);
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `CPN-${dateStr}-${suffix}`;
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

function currentUtcWeekRange(now: Date): { from: Date; to: Date } {
  const day = now.getUTCDay(); // 0..6 (Sun..Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const from = new Date(now);
  from.setUTCDate(now.getUTCDate() + diffToMonday);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function formatSigned(value: number, digits: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function couponWindow(couponDate: Date, now: Date): string {
  const couponDay = startOfUtcDay(couponDate).getTime();
  const currentDay = startOfUtcDay(now).getTime();
  if (couponDay === currentDay) return "Aujourd'hui";
  if (couponDay > currentDay) return 'À venir';
  return 'Soldé';
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
