import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BULLMQ_DEFAULT_JOB_OPTIONS,
  BULLMQ_QUEUES,
} from '@/config/etl.constants';
import { PrismaService } from '@/prisma.service';
import type { MlBackfillJobData } from './ml.backfill.worker';

type BackfillQueueResult = {
  queued: number;
  seasonIds: string[];
};

@Injectable()
export class MlBackfillService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BULLMQ_QUEUES.ML_BACKFILL)
    private readonly queue: Queue<MlBackfillJobData>,
  ) {}

  async queueAllSeasons(): Promise<BackfillQueueResult> {
    const seasons = await this.prisma.client.season.findMany({
      select: { id: true },
    });

    const jobs = await this.queue.addBulk(
      seasons.map(({ id }) => ({
        name: 'backfill-season',
        data: { seasonId: id },
        opts: BULLMQ_DEFAULT_JOB_OPTIONS,
      })),
    );

    return {
      queued: jobs.length,
      seasonIds: seasons.map((s) => s.id),
    };
  }
}
