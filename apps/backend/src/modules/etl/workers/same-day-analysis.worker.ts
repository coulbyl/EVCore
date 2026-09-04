import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@utils/logger';
import {
  BULLMQ_QUEUES,
  SAME_DAY_ANALYSIS_DEFAULT_WINDOW_HOURS,
} from '@config/etl.constants';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type SameDayAnalysisJobData = Record<string, never>;

const logger = createLogger('same-day-analysis-worker');

// Closes the gap BETTING_ENGINE_ANALYSIS's own comment (etl.constants.ts)
// used to flag: that cron only ever targets tomorrow, so nothing
// automatically re-read a fixture on its own match day before kickoff.
// This one does, but scoped tight (BettingEngineService.analyzeUpcoming) —
// see that method's doc comment for why a window, not the whole day.
@Processor(BULLMQ_QUEUES.SAME_DAY_ANALYSIS)
export class SameDayAnalysisWorker extends WorkerHost {
  private readonly windowHours: number;

  constructor(
    private readonly bettingEngineService: BettingEngineService,
    private readonly notification: NotificationService,
    config: ConfigService,
  ) {
    super();
    const parsed = Number.parseFloat(
      config.get<string>(
        'SAME_DAY_ANALYSIS_WINDOW_HOURS',
        String(SAME_DAY_ANALYSIS_DEFAULT_WINDOW_HOURS),
      ),
    );
    this.windowHours =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : SAME_DAY_ANALYSIS_DEFAULT_WINDOW_HOURS;
  }

  async process(_job: Job<SameDayAnalysisJobData>): Promise<void> {
    logger.info({ windowHours: this.windowHours }, 'Starting same-day recheck');

    const result = await this.bettingEngineService.analyzeUpcoming(
      this.windowHours,
    );

    logger.info(result, 'Same-day recheck complete');
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SameDayAnalysisJobData> | undefined, error: Error): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.SAME_DAY_ANALYSIS,
      job,
      error,
      logger,
    });
  }
}
