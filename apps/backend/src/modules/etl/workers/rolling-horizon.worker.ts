import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
  InjectFlowProducer,
} from '@nestjs/bullmq';
import { Job, FlowProducer } from 'bullmq';
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

@Processor(BULLMQ_QUEUES.ROLLING_HORIZON)
export class RollingHorizonWorker extends WorkerHost {
  constructor(
    private readonly notification: NotificationService,
    @InjectFlowProducer('rolling-horizon-flow')
    private readonly flowProducer: FlowProducer,
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

    for (const date of dates) {
      // FlowProducer guarantees the analysis (parent) only runs after the
      // odds sync (child) has completed successfully.
      await this.flowProducer.add({
        name: `rolling-horizon-analysis-${date}`,
        queueName: BULLMQ_QUEUES.BETTING_ENGINE,
        data: { date } satisfies BettingEngineAnalysisJobData,
        opts: BULLMQ_DEFAULT_JOB_OPTIONS,
        children: [
          {
            name: `rolling-horizon-odds-${date}`,
            queueName: BULLMQ_QUEUES.ODDS_PREMATCH_SYNC,
            data: { date } satisfies OddsPrematchSyncJobData,
            opts: BULLMQ_DEFAULT_JOB_OPTIONS,
          },
        ],
      });

      logger.info({ date }, 'Enqueued horizon flow (odds → analysis)');
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
