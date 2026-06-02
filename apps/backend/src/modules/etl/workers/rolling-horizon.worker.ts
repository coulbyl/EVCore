import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectQueue,
} from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { addDays } from 'date-fns';
import { createLogger } from '@utils/logger';
import { formatDateUtc } from '@utils/date.utils';
import {
  BULLMQ_QUEUES,
  BULLMQ_DEFAULT_JOB_OPTIONS,
  ROLLING_HORIZON_DEFAULTS,
} from '@config/etl.constants';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';
import type { OddsPrematchSyncJobData } from './odds-prematch-sync.worker';
import type { BettingEngineAnalysisJobData } from './betting-engine-analysis.worker';

export type RollingHorizonJobData = {
  startOffsetDays?: number;
  horizonDays?: number;
};

const logger = createLogger('rolling-horizon-worker');

// Inter-step delay between successive odds/analysis enqueues (best-effort ordering).
const STEP_DELAY_MS = 5_000;

@Processor(BULLMQ_QUEUES.ROLLING_HORIZON)
export class RollingHorizonWorker extends WorkerHost {
  constructor(
    private readonly notification: NotificationService,
    @InjectQueue(BULLMQ_QUEUES.ODDS_PREMATCH_SYNC)
    private readonly oddsPrematchQueue: Queue<OddsPrematchSyncJobData>,
    @InjectQueue(BULLMQ_QUEUES.BETTING_ENGINE)
    private readonly bettingEngineQueue: Queue<BettingEngineAnalysisJobData>,
  ) {
    super();
  }

  async process(job: Job<RollingHorizonJobData>): Promise<void> {
    const startOffset =
      job.data.startOffsetDays ?? ROLLING_HORIZON_DEFAULTS.START_OFFSET_DAYS;
    const horizonDays =
      job.data.horizonDays ?? ROLLING_HORIZON_DEFAULTS.HORIZON_DAYS;

    const today = new Date();
    const dates: string[] = Array.from({ length: horizonDays }, (_, i) =>
      formatDateUtc(addDays(today, startOffset + i)),
    );

    logger.info({ dates, startOffset, horizonDays }, 'Rolling horizon started');

    for (const [i, date] of dates.entries()) {
      const stepBase = i * 2 * STEP_DELAY_MS;

      await this.oddsPrematchQueue.add(
        `rolling-horizon-odds-${date}`,
        { date } satisfies OddsPrematchSyncJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: stepBase },
      );

      await this.bettingEngineQueue.add(
        `rolling-horizon-analysis-${date}`,
        { date } satisfies BettingEngineAnalysisJobData,
        { ...BULLMQ_DEFAULT_JOB_OPTIONS, delay: stepBase + STEP_DELAY_MS },
      );

      logger.info(
        { date, oddsDelay: stepBase, analysisDelay: stepBase + STEP_DELAY_MS },
        'Enqueued horizon step',
      );
    }

    logger.info({ dates }, 'Rolling horizon enqueue complete');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<RollingHorizonJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.ROLLING_HORIZON,
      job,
      error,
      logger,
    });
  }
}
