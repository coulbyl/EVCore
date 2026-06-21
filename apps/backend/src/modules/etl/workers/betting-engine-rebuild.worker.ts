import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { createLogger } from '@utils/logger';
import { FixtureStatus } from '@evcore/db';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { PrismaService } from '@/prisma.service';
import { BettingEngineService } from '../../betting-engine/betting-engine.service';
import { NotificationService } from '../../notification/notification.service';
import { notifyOnWorkerFailure } from './etl-worker.utils';

export type BettingEngineRebuildJobData = {
  seasonId: string;
  // Optional inclusive scheduledAt window (ISO YYYY-MM-DD). Lets a rebuild
  // target a slice (e.g. after fixing odds for one week) without re-running
  // whole seasons. Omitted bounds mean the full season range.
  from?: string;
  to?: string;
};

type RebuildResult = {
  seasonId: string;
  analyzed: number;
  skipped: number;
  settled: number;
};

const logger = createLogger('betting-engine-rebuild-worker');

// Builds an inclusive Prisma date filter from ISO date bounds (YYYY-MM-DD).
// `to` covers the whole day (23:59:59.999Z). Returns undefined when unbounded.
function buildScheduledAtFilter(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}

// Historical rebuild worker: re-runs the betting engine on FINISHED fixtures
// that have no ModelRun yet. The `modelRuns: { none: {} }` filter makes the job
// idempotent — re-queuing a season never duplicates runs for fixtures already
// analyzed, which is the guard the standalone replay script lacked.
@Processor(BULLMQ_QUEUES.BETTING_ENGINE_REBUILD)
export class BettingEngineRebuildWorker extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job<BettingEngineRebuildJobData>): Promise<RebuildResult> {
    const { seasonId, from, to } = job.data;
    logger.info({ seasonId, from, to }, 'Rebuild job started');

    const scheduledAt = buildScheduledAtFilter(from, to);

    const fixtures = await this.prisma.client.fixture.findMany({
      where: {
        seasonId,
        status: FixtureStatus.FINISHED,
        modelRuns: { none: {} },
        ...(scheduledAt ? { scheduledAt } : {}),
      },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });

    logger.info({ seasonId, count: fixtures.length }, 'Fixtures to rebuild');

    let analyzed = 0;
    let skipped = 0;
    let settled = 0;

    for (const { id: fixtureId } of fixtures) {
      const result = await this.bettingEngine.analyzeFixture(fixtureId);

      if (result.status !== 'analyzed') {
        skipped++;
        continue;
      }

      const { settled: n } = await this.bettingEngine.settleOpenBets(fixtureId);
      settled += n;
      analyzed++;

      await job.updateProgress(
        Math.round(((analyzed + skipped) / fixtures.length) * 100),
      );
    }

    logger.info({ seasonId, analyzed, skipped, settled }, 'Rebuild job done');
    return { seasonId, analyzed, skipped, settled };
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<BettingEngineRebuildJobData> | undefined,
    error: Error,
  ): void {
    notifyOnWorkerFailure({
      notification: this.notification,
      queueName: BULLMQ_QUEUES.BETTING_ENGINE_REBUILD,
      job,
      error,
      logger,
    });
  }
}
