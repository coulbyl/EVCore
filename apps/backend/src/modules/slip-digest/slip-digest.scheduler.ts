import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { createLogger } from '@utils/logger';
import type { SlipDigestJobData } from './slip-digest.worker';

const logger = createLogger('slip-digest-scheduler');

/**
 * Enregistre la matinée, le relevé du lundi et le résultat des coupons
 * suivis du soir, coupés avec le reste des crons.
 */
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
      await this.queue.removeJobScheduler(SLIP_DIGEST.FOLLOWED_SCHEDULER_KEY);
      logger.info('Slip digest scheduler disabled');
      return;
    }
    // The hours are decisions in code (ENV-PROD § 6), never in the .env.
    const pattern = SLIP_DIGEST.CRON;
    await this.queue.upsertJobScheduler(
      SLIP_DIGEST.SCHEDULER_KEY,
      { pattern },
      {
        name: 'slip-digest',
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 60 },
      },
    );
    const weeklyPattern = SLIP_DIGEST.WEEKLY_CRON;
    await this.queue.upsertJobScheduler(
      SLIP_DIGEST.WEEKLY_SCHEDULER_KEY,
      { pattern: weeklyPattern },
      {
        name: SLIP_DIGEST.WEEKLY_JOB,
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 60 },
      },
    );
    const followedPattern = SLIP_DIGEST.FOLLOWED_CRON;
    await this.queue.upsertJobScheduler(
      SLIP_DIGEST.FOLLOWED_SCHEDULER_KEY,
      { pattern: followedPattern },
      {
        name: SLIP_DIGEST.FOLLOWED_JOB,
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 60 },
      },
    );
    logger.info(
      { pattern, weeklyPattern, followedPattern },
      'Slip digest scheduler registered',
    );
  }
}
