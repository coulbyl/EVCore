import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { formatDateUtc, tomorrowUtc } from '@utils/date.utils';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type BettingEngineAnalysisJobData = { date?: string };

const logger = createLogger('betting-engine-analysis-worker');

@Processor(BULLMQ_QUEUES.BETTING_ENGINE)
export class BettingEngineAnalysisWorker extends WorkerHost {
  constructor(
    private readonly bettingEngineService: BettingEngineService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<BettingEngineAnalysisJobData>): Promise<void> {
    const date = job.data.date ?? formatDateUtc(tomorrowUtc());

    logger.info({ date }, 'Starting betting engine daily analysis');

    const result = await this.bettingEngineService.analyzeByDate(date);

    logger.info(result, 'Betting engine daily analysis complete');

    // Used to enqueue an AI_ENGINE 'generate-coupons' job here — retired
    // 2026-09-03 alongside CouponComposerService. Coupon composition is now
    // apps/vantage-worker's own LLM pipeline, on its own independent
    // scheduler (VANTAGE_COUPON_CRON, default 30 minutes after this cron's
    // default 20:00 UTC) rather than triggered from this job. See
    // docs/vantage-centric-redesign-2026-09-01.md §9bis.
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<BettingEngineAnalysisJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.BETTING_ENGINE,
      job,
      error,
      logger,
    });
  }
}
