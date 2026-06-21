import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
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
  failed: number;
  settled: number;
};

const logger = createLogger('betting-engine-rebuild-worker');

// Fixtures rebuilt in parallel per batch. The work is I/O-bound (DB round-trips),
// so a small batch overlaps latency without starving CPU/memory (per-fixture
// state is GC'd between batches; only `id`s are held in memory). The worker runs
// in-process with the live API and shares its Prisma pool, so the default is
// deliberately low to leave connections for HTTP requests — raise
// ETL_REBUILD_CONCURRENCY when no one is using the UI. Keep it well under the
// Prisma connection_limit.
const DEFAULT_REBUILD_CONCURRENCY = 4;
// Log progress + push BullMQ progress every N fixtures, instead of once per
// fixture — avoids thousands of Redis round-trips on a full-season rebuild.
const PROGRESS_EVERY = 100;

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
  private readonly concurrency: number;

  // eslint-disable-next-line max-params -- Nest constructor injection of 4 providers.
  constructor(
    private readonly prisma: PrismaService,
    private readonly bettingEngine: BettingEngineService,
    private readonly notification: NotificationService,
    config: ConfigService,
  ) {
    super();
    const parsed = Number.parseInt(
      config.get<string>(
        'ETL_REBUILD_CONCURRENCY',
        String(DEFAULT_REBUILD_CONCURRENCY),
      ),
      10,
    );
    this.concurrency =
      Number.isInteger(parsed) && parsed > 0
        ? parsed
        : DEFAULT_REBUILD_CONCURRENCY;
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

    const total = fixtures.length;
    logger.info({ seasonId, total }, 'Fixtures to rebuild');

    let analyzed = 0;
    let skipped = 0;
    let failed = 0;
    let settled = 0;
    let processed = 0;
    let lastLogged = 0;

    for (let i = 0; i < total; i += this.concurrency) {
      const batch = fixtures.slice(i, i + this.concurrency);
      const outcomes = await Promise.allSettled(
        batch.map(({ id }) => this.rebuildFixture(id)),
      );

      for (let j = 0; j < outcomes.length; j += 1) {
        const outcome = outcomes[j];
        if (outcome.status === 'rejected') {
          // Isolate failures: one bad fixture (deadlock, bad data, …) must not
          // abort the whole rebuild — log it, count it, keep going. Idempotency
          // (`modelRuns: none`) means a later re-run retries only the failures.
          failed += 1;
          logger.warn(
            {
              seasonId,
              fixtureId: batch[j].id,
              err:
                outcome.reason instanceof Error
                  ? outcome.reason.message
                  : String(outcome.reason),
            },
            'Fixture rebuild failed — skipped',
          );
        } else if (outcome.value.analyzed) {
          analyzed += 1;
          settled += outcome.value.settled;
        } else {
          skipped += 1;
        }
      }

      processed += batch.length;
      if (processed - lastLogged >= PROGRESS_EVERY || processed === total) {
        lastLogged = processed;
        logger.info(
          { seasonId, processed, total, analyzed, skipped, failed, settled },
          'Rebuild progress',
        );
        await job.updateProgress(
          total === 0 ? 100 : Math.round((processed / total) * 100),
        );
      }
    }

    logger.info(
      { seasonId, analyzed, skipped, failed, settled },
      'Rebuild job done',
    );
    return { seasonId, analyzed, skipped, failed, settled };
  }

  private async rebuildFixture(
    fixtureId: string,
  ): Promise<{ analyzed: boolean; settled: number }> {
    const result = await this.bettingEngine.analyzeFixture(fixtureId);
    if (result.status !== 'analyzed') {
      return { analyzed: false, settled: 0 };
    }
    const { settled } = await this.bettingEngine.settleOpenBets(fixtureId);
    return { analyzed: true, settled };
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
