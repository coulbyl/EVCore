import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { ODDS_ARCHIVE } from '@config/odds-archive.constants';
import { createLogger } from '@utils/logger';

const logger = createLogger('odds-archive-scheduler');

/** The nightly archive, cut with the other crons (ETL_SCHEDULING_ENABLED). */
@Injectable()
export class OddsArchiveScheduler implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(ODDS_ARCHIVE.QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('ETL_SCHEDULING_ENABLED', 'true') === 'false') {
      await this.queue.removeJobScheduler(ODDS_ARCHIVE.SCHEDULER_KEY);
      logger.info('Odds archive scheduler disabled');
      return;
    }
    await this.queue.upsertJobScheduler(
      ODDS_ARCHIVE.SCHEDULER_KEY,
      { pattern: ODDS_ARCHIVE.CRON },
      {
        name: ODDS_ARCHIVE.JOB,
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 60 },
      },
    );
    logger.info(
      { pattern: ODDS_ARCHIVE.CRON },
      'Odds archive scheduler registered',
    );
  }
}
