import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { addDays } from 'date-fns';
import { createLogger } from '@utils/logger';
import { formatDateUtc } from '@utils/date.utils';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { CouponService } from '../../coupon/coupon.service';
import { CouponSettlementService } from '../../coupon/coupon-settlement.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';
import type { AiEngineJobData } from './betting-engine-analysis.worker';

const logger = createLogger('coupon-worker');

// Weekend (Fri→Sun) and midweek European-nights (Tue→Thu) coupon windows —
// every other day stays single-day (unchanged behaviour). `date` is the day
// betting-engine-analysis just finished analyzing (J+1), which is also the
// day the resulting CouponProposal.forDate is keyed on; only the fixture pool
// widens to `to`.
//
// Ne renvoie plus de `longshotProfile` : les profils ont été supprimés le
// 2026-08-22 (voir COUPON_BOUNDS). La fenêtre multi-jours, elle, reste utile
// et indépendante — elle élargit simplement le vivier de matchs disponibles
// un vendredi ou un mardi.
export function resolveGenerationWindow(date: string): {
  to: string;
} {
  // Noon UTC — same "avoid any timezone/DST boundary" trick used elsewhere
  // in this codebase (cf. the removed per-call `date` param in
  // CouponComposerService.scorePicks) — a plain `new Date(date)` would parse
  // as local midnight and could land on the wrong UTC calendar day.
  const noonUtc = new Date(`${date}T12:00:00.000Z`);
  const dow = noonUtc.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 5) {
    return { to: formatDateUtc(addDays(noonUtc, 2)) };
  }
  if (dow === 2) {
    return { to: formatDateUtc(addDays(noonUtc, 2)) };
  }
  return { to: date };
}

@Processor(BULLMQ_QUEUES.AI_ENGINE)
export class CouponWorker extends WorkerHost {
  constructor(
    private readonly coupon: CouponService,
    private readonly couponSettlement: CouponSettlementService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<AiEngineJobData>): Promise<void> {
    const { date } = job.data;
    const { to } = resolveGenerationWindow(date);
    logger.info({ date, to }, 'Starting coupon generation');
    await this.coupon.generateCoupons(date, { to });
    logger.info({ date, to }, 'Coupon generation complete');

    await this.couponSettlement.settleReadyProposals();
    logger.info({ date }, 'Ready coupon settlement complete');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiEngineJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.AI_ENGINE,
      job,
      error,
      logger,
    });
  }
}
