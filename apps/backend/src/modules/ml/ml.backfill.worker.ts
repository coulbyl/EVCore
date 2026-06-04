import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '@modules/betting-engine/betting-engine.service';
import { FixtureStatus } from '@evcore/db';

export type MlBackfillJobData = { seasonId: string };

type BackfillResult = {
  seasonId: string;
  analyzed: number;
  skipped: number;
  settled: number;
};

const logger = createLogger('ml-backfill-worker');

@Processor(BULLMQ_QUEUES.ML_BACKFILL)
export class MlBackfillWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
  ) {
    super();
  }

  async process(job: Job<MlBackfillJobData>): Promise<BackfillResult> {
    const { seasonId } = job.data;
    logger.info({ seasonId }, 'Backfill job started');

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        seasonId,
        status: FixtureStatus.FINISHED,
        modelRuns: { none: {} },
      },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });

    logger.info({ seasonId, count: fixtures.length }, 'Fixtures to backfill');

    let analyzed = 0;
    let skipped = 0;
    let settled = 0;

    for (const { id: fixtureId } of fixtures) {
      const result = await this.bettingEngine.analyzeFixture(fixtureId);

      if (result.status !== 'analyzed') {
        skipped++;
        continue;
      }

      await this.prisma.client.modelRun.update({
        where: { id: result.modelRunId },
        data: { isBackfill: true },
      });

      const { settled: n } = await this.bettingEngine.settleOpenBets(fixtureId);
      settled += n;
      analyzed++;

      await job.updateProgress(
        Math.round(((analyzed + skipped) / fixtures.length) * 100),
      );
    }

    logger.info({ seasonId, analyzed, skipped, settled }, 'Backfill job done');
    return { seasonId, analyzed, skipped, settled };
  }
}
