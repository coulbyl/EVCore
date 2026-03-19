import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { BetStatus, CouponStatus } from '@evcore/db';
import { createLogger } from '@utils/logger';
import { toNumber } from '@utils/prisma.utils';
import {
  BettingEngineService,
  type BetCandidate,
} from '@modules/betting-engine/betting-engine.service';
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
import { formatTimeUtc, tomorrowUtc } from '@utils/date.utils';
import { CouponRepository } from './coupon.repository';

const logger = createLogger('coupon-service');
const COUPON_LATE_KICKOFF_GRACE_MS = 30 * 60 * 1000;

type CouponWindowInput = {
  startDate: Date;
  days?: number;
};

type CouponSelectionSnapshot = {
  id: string;
  fixtureId: string;
  fixture: string;
  scheduledAt: string;
  status: 'PENDING' | 'WON' | 'LOST' | 'VOID';
  market: string;
  pick: string;
  probEstimated: string;
  lambdaHome: string | null;
  lambdaAway: string | null;
  expectedTotalGoals: string | null;
  odds: string;
  ev: string;
  candidatePicks: CouponCandidateSnapshot[];
  evaluatedPicks: CouponEvaluatedPickSnapshot[];
};

type CouponCandidateSnapshot = {
  market: string;
  pick: string;
  comboMarket?: string;
  comboPick?: string;
  probability: string;
  odds: string;
  ev: string;
  qualityScore: string;
};

type CouponEvaluatedPickSnapshot = CouponCandidateSnapshot & {
  status: 'viable' | 'rejected';
  rejectionReason?: string;
};

type CouponPeriodSnapshot = {
  id: string;
  code: string;
  status: 'PENDING' | 'WON' | 'LOST';
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

    const fixtures =
      days === 1
        ? await this.fixtureService.findScheduledForDate(startDate)
        : await this.fixtureService.findScheduledInRange(startDate, endDate);
    const now = new Date();
    const eligibleFixtures = fixtures.filter(
      (fixture) =>
        fixture.scheduledAt.getTime() + COUPON_LATE_KICKOFF_GRACE_MS >
        now.getTime(),
    );

    if (eligibleFixtures.length === 0) {
      logger.info(
        {
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          days,
        },
        'No scheduled fixtures — skipping coupon generation',
      );
      await this.notificationService.sendNoBetToday(startDate);
      return;
    }

    // Option B: exclude fixtures already assigned to an existing PENDING coupon
    // for this window, so each generation surfaces new fixtures.
    const excludedFixtureIds =
      await this.couponRepository.findPendingFixtureIdsForWindow(
        startDate,
        endDate,
      );
    const availableFixtures = eligibleFixtures.filter(
      (f) => !excludedFixtureIds.has(f.id),
    );

    if (availableFixtures.length === 0) {
      logger.info(
        {
          startDate: startDate.toISOString().slice(0, 10),
          coveredFixtures: excludedFixtureIds.size,
        },
        'All scheduled fixtures already covered by existing PENDING coupons — skipping',
      );
      return;
    }

    // Analyze available fixtures and collect valueBets from the current run.
    const analyzed = await Promise.all(
      availableFixtures.map(({ id: fixtureId }) =>
        this.bettingEngineService.analyzeFixture(fixtureId),
      ),
    );
    const valueBets = analyzed.flatMap((result) =>
      result.status === 'analyzed' && result.valueBet !== null
        ? [result.valueBet]
        : [],
    );

    if (valueBets.length === 0) {
      logger.info(
        'No bets generated by current analysis — skipping coupon generation',
      );
      await this.notificationService.sendNoBetToday(startDate);
      return;
    }

    // Anti-correlation: keep only the best bet per fixture.
    const bestByFixture = new Map<string, BetCandidate>();
    for (const bet of valueBets) {
      const current = bestByFixture.get(bet.fixtureId);
      if (!current || bet.qualityScore.greaterThan(current.qualityScore)) {
        bestByFixture.set(bet.fixtureId, bet);
      }
    }

    // Sort by qualityScore DESC and cap at COUPON_MAX_LEGS.
    const selected = Array.from(bestByFixture.values()).sort((a, b) =>
      b.qualityScore.comparedTo(a.qualityScore),
    );
    const legs = selected.slice(0, COUPON_MAX_LEGS);

    const { id: couponId, betIds } =
      await this.couponRepository.createPendingCouponWithBets({
        code: generateCouponCode(startDate),
        date: startDate,
        legCount: legs.length,
        bets: legs,
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
      id: couponId,
      date: startDate,
      legCount: legs.length,
      bets: fullBets,
    });

    logger.info({ couponId, legCount: legs.length }, 'Daily coupon created');
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

  async getCouponById(couponId: string) {
    const coupon = await this.couponRepository.findCouponById(couponId);
    if (!coupon) return null;

    return {
      ...coupon,
      bets: coupon.bets.map((bet) => {
        const diagnostics = extractBetDiagnostics(bet.modelRun.features);
        return {
          ...bet,
          probEstimated: toNumber(bet.probEstimated).toFixed(4),
          ev: toNumber(bet.ev).toFixed(4),
          oddsSnapshot: toNumber(bet.oddsSnapshot).toFixed(2),
          ...diagnostics,
          lambdaHome: formatNullableNumber(diagnostics.lambdaHome),
          lambdaAway: formatNullableNumber(diagnostics.lambdaAway),
          expectedTotalGoals: formatNullableNumber(
            diagnostics.expectedTotalGoals,
          ),
        };
      }),
    };
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
      coupons: coupons.map((coupon) => {
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
          legs: coupon.bets.length,
          ev: formatSigned(avgEv, 2),
          window: couponWindow(coupon.date, now),
          selections: coupon.bets.map((bet) => {
            const diagnostics = extractBetDiagnostics(bet.modelRun.features);
            const comboParts = [bet.pick];
            if (bet.comboMarket && bet.comboPick) {
              comboParts.push(`${bet.comboMarket} ${bet.comboPick}`);
            }
            return {
              id: bet.id,
              fixtureId: bet.modelRun.fixture.id,
              fixture: `${bet.modelRun.fixture.homeTeam.name} vs ${bet.modelRun.fixture.awayTeam.name}`,
              scheduledAt: formatTimeUtc(bet.modelRun.fixture.scheduledAt),
              status:
                bet.status === 'WON' ||
                bet.status === 'LOST' ||
                bet.status === 'VOID'
                  ? bet.status
                  : 'PENDING',
              market: bet.market,
              pick: comboParts.join(' + '),
              probEstimated: `${(toNumber(bet.probEstimated) * 100).toFixed(1)}%`,
              lambdaHome: formatNullableNumber(diagnostics.lambdaHome),
              lambdaAway: formatNullableNumber(diagnostics.lambdaAway),
              expectedTotalGoals: formatNullableNumber(
                diagnostics.expectedTotalGoals,
              ),
              odds: toNumber(bet.oddsSnapshot).toFixed(2),
              ev: formatSigned(toNumber(bet.ev), 3),
              candidatePicks: diagnostics.candidatePicks,
              evaluatedPicks: diagnostics.evaluatedPicks,
            };
          }),
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

function extractBetDiagnostics(features: unknown): {
  lambdaHome: number | null;
  lambdaAway: number | null;
  expectedTotalGoals: number | null;
  candidatePicks: CouponCandidateSnapshot[];
  evaluatedPicks: CouponEvaluatedPickSnapshot[];
} {
  if (!features || typeof features !== 'object') {
    return {
      lambdaHome: null,
      lambdaAway: null,
      expectedTotalGoals: null,
      candidatePicks: [],
      evaluatedPicks: [],
    };
  }

  const lambdaHome = readFiniteNumber(features, 'lambdaHome');
  const lambdaAway = readFiniteNumber(features, 'lambdaAway');

  return {
    lambdaHome,
    lambdaAway,
    expectedTotalGoals:
      lambdaHome !== null && lambdaAway !== null
        ? lambdaHome + lambdaAway
        : null,
    candidatePicks: readCandidatePicks(features),
    evaluatedPicks: readEvaluatedPicks(features),
  };
}

function readFiniteNumber(value: object, key: string): number | null {
  const entry = value as Record<string, unknown>;
  const raw = entry[key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return null;
  }
  return raw;
}

function formatNullableNumber(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

function readCandidatePicks(features: object): CouponCandidateSnapshot[] {
  const entry = features as Record<string, unknown>;
  const raw = entry['candidatePicks'];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((candidate) =>
    candidate && typeof candidate === 'object'
      ? readPickSnapshot(candidate as Record<string, unknown>)
      : [],
  );
}

function readEvaluatedPicks(features: object): CouponEvaluatedPickSnapshot[] {
  const entry = features as Record<string, unknown>;
  const raw = entry['evaluatedPicks'];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return [];
    }

    const record = candidate as Record<string, unknown>;
    const status = readString(record, 'status');
    if (status !== 'viable' && status !== 'rejected') {
      return [];
    }

    return readPickSnapshot(record).map((pick) => {
      const rejectionReason = readString(record, 'rejectionReason');
      return {
        ...pick,
        status,
        ...(rejectionReason ? { rejectionReason } : {}),
      };
    });
  });
}

function readPickSnapshot(
  record: Record<string, unknown>,
): CouponCandidateSnapshot[] {
  const market = readString(record, 'market');
  const pick = readString(record, 'pick');
  const probability = readFiniteNumber(record, 'probability');
  const odds = readFiniteNumber(record, 'odds');
  const ev = readFiniteNumber(record, 'ev');
  const qualityScore = readFiniteNumber(record, 'qualityScore');

  if (
    market === null ||
    pick === null ||
    probability === null ||
    odds === null ||
    ev === null ||
    qualityScore === null
  ) {
    return [];
  }

  const comboMarket = readString(record, 'comboMarket');
  const comboPick = readString(record, 'comboPick');

  return [
    {
      market,
      pick,
      ...(comboMarket ? { comboMarket } : {}),
      ...(comboPick ? { comboPick } : {}),
      probability: probability.toFixed(4),
      odds: odds.toFixed(2),
      ev: formatSigned(ev, 4),
      qualityScore: qualityScore.toFixed(4),
    },
  ];
}

function readString(value: object, key: string): string | null {
  const entry = value as Record<string, unknown>;
  const raw = entry[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
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
