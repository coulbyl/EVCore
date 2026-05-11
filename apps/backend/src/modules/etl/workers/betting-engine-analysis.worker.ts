import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { createLogger } from '@utils/logger';
import { formatDateUtc, tomorrowUtc } from '@utils/date.utils';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
} from '@config/etl.constants';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type BettingEngineAnalysisJobData = { date?: string };
export type AiEngineJobData = { date: string };

const logger = createLogger('betting-engine-analysis-worker');

@Processor(BULLMQ_QUEUES.BETTING_ENGINE)
export class BettingEngineAnalysisWorker extends WorkerHost {
  constructor(
    private readonly bettingEngineService: BettingEngineService,
    private readonly notification: NotificationService,
    @InjectQueue(BULLMQ_QUEUES.AI_ENGINE)
    private readonly aiEngineQueue: Queue<AiEngineJobData>,
  ) {
    super();
  }

  async process(job: Job<BettingEngineAnalysisJobData>): Promise<void> {
    const date = job.data.date ?? formatDateUtc(tomorrowUtc());

    logger.info({ date }, 'Starting betting engine daily analysis');

    const result = await this.bettingEngineService.analyzeByDate(date);

    logger.info(result, 'Betting engine daily analysis complete');

    await this.aiEngineQueue.add(
      'generate-coupons',
      { date },
      BULLMQ_DEFAULT_JOB_OPTIONS,
    );
    logger.info({ date }, 'AI engine coupon generation queued');
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
