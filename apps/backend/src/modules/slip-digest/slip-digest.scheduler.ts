import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { createLogger } from '@utils/logger';
import type { SlipDigestJobData } from './slip-digest.worker';

const logger = createLogger('slip-digest-scheduler');

/** Enregistre la matinée et le relevé du lundi, coupés avec le reste des crons. */
@Injectable()
export class SlipDigestScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(SLIP_DIGEST.QUEUE)
    private readonly queue: Queue<SlipDigestJobData>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('ETL_SCHEDULING_ENABLED', 'true') === 'false') {
      await this.queue.removeJobScheduler(SLIP_DIGEST.SCHEDULER_KEY);
      await this.queue.removeJobScheduler(SLIP_DIGEST.WEEKLY_SCHEDULER_KEY);
      logger.info('Slip digest scheduler disabled');
      return;
    }
    const pattern = this.config.get<string>(
      'SLIP_DIGEST_CRON',
      SLIP_DIGEST.CRON,
    );
    await this.queue.upsertJobScheduler(
      SLIP_DIGEST.SCHEDULER_KEY,
      { pattern },
      {
        name: 'slip-digest',
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 60 },
      },
    );
    const weeklyPattern = this.config.get<string>(
      'WEEKLY_STATEMENT_CRON',
      SLIP_DIGEST.WEEKLY_CRON,
    );
    await this.queue.upsertJobScheduler(
      SLIP_DIGEST.WEEKLY_SCHEDULER_KEY,
      { pattern: weeklyPattern },
      {
        name: SLIP_DIGEST.WEEKLY_JOB,
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 60 },
      },
    );
    logger.info({ pattern, weeklyPattern }, 'Slip digest scheduler registered');
  }
}
