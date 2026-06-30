import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { CouponService } from '../../coupon/coupon.service';
import { CouponSettlementService } from '../../coupon/coupon-settlement.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';
import type { AiEngineJobData } from './betting-engine-analysis.worker';

const logger = createLogger('coupon-worker');

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
    logger.info({ date }, 'Starting coupon generation');
    await this.coupon.generateCoupons(date);
    logger.info({ date }, 'Coupon generation complete');
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
