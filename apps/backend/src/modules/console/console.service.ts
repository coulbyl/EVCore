import { Injectable } from '@nestjs/common';
import { CONSOLE_RULES as R } from '@config/console.constants';
import { CouponService } from '@modules/coupon/coupon.service';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import { consoleStatusOf } from './console-rules';
import { ConsoleRepository } from './console.repository';
import type { ConsoleSignals, ConsoleStatus } from './console.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The admin's home (docs/refonte-ui/12-admin.md § 1): the signals read
 * together, the rules applied by consoleStatusOf.
 */
@Injectable()
export class ConsoleService {
  constructor(
    private readonly repository: ConsoleRepository,
    private readonly coupons: CouponService,
  ) {}

  async getStatus(now: Date = new Date()): Promise<ConsoleStatus> {
    return consoleStatusOf(await this.signals(now));
  }

  async signals(now: Date): Promise<ConsoleSignals> {
    const today = startOfUtcDay(now);
    const windowStart = new Date(
      today.getTime() - (R.PRODUCT_ABSENT_WINDOW_DAYS - 1) * DAY_MS,
    );
    const [
      lastOddsAt,
      etlFailures,
      statsLate,
      tomorrowCoupons,
      lastAnalysisAt,
      lastAiAt,
      abstentions,
      suspensions,
      lastPlayerSeenAt,
      unansweredMessages,
    ] = await Promise.all([
      this.repository.lastOddsAt(),
      this.repository.etlFailures(
        new Date(now.getTime() - R.ETL_FAILURE_HOURS * HOUR_MS),
      ),
      this.repository.statsLate(now),
      this.repository.countCouponsFor(new Date(today.getTime() + DAY_MS)),
      this.repository.lastAnalysisAt(),
      this.repository.lastAiAt(),
      this.coupons.getProductAbstentions({
        from: windowStart,
        to: new Date(today.getTime() + DAY_MS),
      }),
      this.repository.activeSuspensions(),
      this.repository.lastPlayerSeenAt(),
      this.repository.unansweredMessages(now),
    ]);

    const todayKey = formatDateUtc(today);
    const byProduct = new Map<string, Set<string>>();
    for (const row of abstentions) {
      const days = byProduct.get(row.product) ?? new Set<string>();
      days.add(row.date);
      byProduct.set(row.product, days);
    }
    return {
      now,
      lastOddsAt,
      etlFailures,
      statsLate,
      tomorrowCoupons,
      lastAnalysisAt,
      lastAiAt,
      absences: [...byProduct].map(([product, days]) => ({
        product,
        days: days.size,
        today: days.has(todayKey),
      })),
      suspendedMarkets: suspensions.map((s) => ({
        market: s.market,
        since: s.createdAt,
      })),
      lastPlayerSeenAt,
      unansweredMessages,
    };
  }
}
