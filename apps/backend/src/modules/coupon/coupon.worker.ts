import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import pino from 'pino';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { NotificationService } from '@modules/notification/notification.service';
import { tomorrowUtc } from '@utils/date.utils';
import { CouponService } from './coupon.service';

export type CouponJobData = { date?: string };

const logger = pino({ name: 'coupon-worker' });

// lockDuration: 5 min — analyzeFixture may take several seconds per fixture.
@Processor(BULLMQ_QUEUES.BETTING_ENGINE, { lockDuration: 300_000 })
export class CouponWorker extends WorkerHost {
  constructor(
    private readonly couponService: CouponService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<CouponJobData>): Promise<void> {
    const date = job.data.date ? new Date(job.data.date) : tomorrowUtc();
    logger.info(
      { date: date.toISOString().slice(0, 10) },
      'Processing daily coupon job',
    );
    await this.couponService.generateDailyCoupon(date);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CouponJobData> | undefined, error: Error): void {
    const isFinalAttempt =
      job !== undefined && job.attemptsMade >= (job.opts.attempts ?? 1);

    if (isFinalAttempt) {
      logger.error(
        { jobName: job.name, attempts: job.attemptsMade },
        'Coupon job permanently failed — sending alert',
      );
      void this.notification.sendEtlFailureAlert(
        BULLMQ_QUEUES.BETTING_ENGINE,
        job.name,
        error.message,
      );
    } else {
      logger.warn(
        { jobName: job?.name, attempt: job?.attemptsMade },
        'Coupon job attempt failed — will retry',
      );
    }
  }
}
