import { Injectable } from '@nestjs/common';
import { CONSOLE_RULES as R } from '@config/console.constants';
import { CouponService } from '@modules/coupon/coupon.service';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import { ConsoleEngineService } from './console-engine.service';
import { ConsoleQueuesService } from './console-queues.service';
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
  // eslint-disable-next-line max-params -- NestJS constructor injection: the console's reads, coupons, Moteur, the queues
  constructor(
    private readonly repository: ConsoleRepository,
    private readonly coupons: CouponService,
    private readonly engine: ConsoleEngineService,
    private readonly queues: ConsoleQueuesService,
  ) {}

  async getStatus(now: Date = new Date()): Promise<ConsoleStatus> {
    const [signals, recorded, yesterday, passesOff] = await Promise.all([
      this.signals(now),
      this.repository.lights(),
      this.repository.dayFigures(
        new Date(startOfUtcDay(now).getTime() - DAY_MS),
      ),
      this.repository.passesOff(),
    ]);
    const status = consoleStatusOf(signals);
    status.yesterday = yesterday;
    status.passesOff = passesOff
      ? { since: passesOff.since.toISOString(), by: passesOff.by }
      : null;
    // The time a light entered its state, from the ten-minute check.
    for (const row of recorded) {
      const key = row.light as keyof ConsoleStatus['lights'];
      if (key in status.lights && status.lights[key] === row.state) {
        status.since[key] = row.changedAt.toISOString();
      }
    }
    return status;
  }

  async signals(now: Date): Promise<ConsoleSignals> {
    const today = startOfUtcDay(now);
    const windowStart = new Date(
      today.getTime() - (R.PRODUCT_ABSENT_WINDOW_DAYS - 1) * DAY_MS,
    );
    const [
      lastOddsAt,
      quotaFailures,
      queueFailures,
      statsLate,
      tomorrowCoupons,
      lastAnalysisAt,
      lastAiAt,
      abstentions,
      suspensions,
      lastPlayerSeenAt,
      unansweredMessages,
      channels,
    ] = await Promise.all([
      this.repository.lastOddsAt(),
      this.repository.etlFailures(
        new Date(now.getTime() - R.ETL_FAILURE_HOURS * HOUR_MS),
      ),
      // A failure still in its queue: « Effacer l'échec » acknowledges it
      // here too (Exploitation). The quota stays read from its alert.
      this.queues.failures(now),
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
      this.engine.getChannels(now),
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
      etlFailures: {
        count: queueFailures.count + (quotaFailures.quotaBody ? 1 : 0),
        lastBody: queueFailures.last,
        quotaBody: quotaFailures.quotaBody,
      },
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
      // A market already suspended says so on its own line: its cells'
      // alerts would only repeat it.
      channelAlerts: channels
        .filter(
          (cell) =>
            cell.word === 'alert' &&
            cell.ratio !== null &&
            !suspensions.some((s) => s.market === cell.channel),
        )
        .map((cell) => ({
          channel: cell.channel,
          competition: cell.competitionCode,
          ratio: cell.ratio ?? 0,
          sample: cell.sample,
        })),
    };
  }
}
