import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import { CONSOLE_WATCH } from '@config/console.constants';
import { createLogger } from '@utils/logger';
import { ConsoleWatchService } from './console-watch.service';

const logger = createLogger('console-watch-scheduler');

/** Registers the ten-minute check, cut with the other crons. */
@Injectable()
export class ConsoleWatchScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(CONSOLE_WATCH.QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('ETL_SCHEDULING_ENABLED', 'true') === 'false') {
      await this.queue.removeJobScheduler(CONSOLE_WATCH.SCHEDULER_KEY);
      logger.info('Console watch disabled');
      return;
    }
    await this.queue.upsertJobScheduler(
      CONSOLE_WATCH.SCHEDULER_KEY,
      { pattern: CONSOLE_WATCH.CRON },
      { name: CONSOLE_WATCH.JOB, data: {} },
    );
  }
}

@Processor(CONSOLE_WATCH.QUEUE)
export class ConsoleWatchWorker extends WorkerHost {
  constructor(private readonly watch: ConsoleWatchService) {
    super();
  }

  process(_job: Job): Promise<unknown> {
    return this.watch.check();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Console watch failed',
    );
  }
}
