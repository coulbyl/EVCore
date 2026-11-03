import { getQueueToken } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';
import {
  CONSOLE_QUEUES,
  CONSOLE_RULES as R,
  type ConsoleQueueKey,
} from '@config/console.constants';
import { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import { StatsBackfillService } from '@modules/etl/stats-backfill.service';
import { OddsArchiveRepository } from '@modules/odds-archive/odds-archive.repository';
import { createLogger } from '@utils/logger';
import {
  queueListOf,
  type QueueReading,
  type QueueView,
} from './console-queues';
import type {
  BackfillView,
  OddsArchiveView,
  QueuesScreen,
} from './console.types';

const logger = createLogger('console-queues');
const HOUR_MS = 60 * 60 * 1000;
/** Failed jobs read per queue: enough to say « N en échec ». */
const FAILED_READ = 50;

/**
 * Exploitation › Les files (docs/refonte-ui/exploitation-inventaire.md): each
 * watched queue read from Redis, the stats catch-up with its figures, and
 * the team's actions on them — retry a failure, clear it, pause or resume
 * the catch-up — each journaled.
 */
@Injectable()
export class ConsoleQueuesService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the queues, the catch-up, the journal, the odds archive
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly backfill: StatsBackfillService,
    private readonly journal: AdminJournalService,
    private readonly oddsArchive: OddsArchiveRepository,
  ) {}

  async getScreen(now: Date = new Date()): Promise<QueuesScreen> {
    const [readings, backfill, oddsArchive] = await Promise.all([
      Promise.all(CONSOLE_QUEUES.map((q) => this.read(q.key))),
      this.backfillView(),
      this.oddsArchiveView(),
    ]);
    return {
      at: now.toISOString(),
      queues: queueListOf(
        readings.filter((r): r is QueueReading => r !== null),
        now,
      ),
      backfill,
      oddsArchive,
    };
  }

  /**
   * Failures of the last ETL_FAILURE_HOURS still in their queues, for the
   * « Données » light: an « Effacer » acknowledges one there too.
   */
  async failures(
    now: Date = new Date(),
  ): Promise<{ count: number; last: string | null }> {
    const screen = await Promise.all(
      CONSOLE_QUEUES.map((q) => this.read(q.key)),
    );
    const views = queueListOf(
      screen.filter((r): r is QueueReading => r !== null),
      now,
    ).filter((v) => v.failure !== null);
    return {
      count: views.length,
      last: views[0]?.failure?.reason ?? null,
    };
  }

  /** « Relancer »: the failed jobs of the last day are retried. */
  async retry(input: {
    key: string;
    actorId: string;
  }): Promise<{ retried: number }> {
    const { key, queue } = this.queueOf(input.key);
    const since = Date.now() - R.ETL_FAILURE_HOURS * HOUR_MS;
    const failed = await queue.getJobs(['failed'], 0, FAILED_READ - 1);
    const recent = failed.filter((job) => (job.finishedOn ?? 0) >= since);
    if (recent.length === 0) {
      throw new ConflictException('Aucun échec à relancer');
    }
    await Promise.all(recent.map((job) => job.retry('failed')));
    await this.journal.record({
      actorId: input.actorId,
      kind: 'queue_retried',
      target: key,
      after: recent.length,
    });
    return { retried: recent.length };
  }

  /** « Effacer l'échec »: the failed jobs leave the queue, understood. */
  async clear(input: {
    key: string;
    actorId: string;
  }): Promise<{ cleared: number }> {
    const { key, queue } = this.queueOf(input.key);
    const removed = await queue.clean(0, 1000, 'failed');
    await this.journal.record({
      actorId: input.actorId,
      kind: 'queue_cleared',
      target: key,
      after: removed.length,
    });
    return { cleared: removed.length };
  }

  /** The stats catch-up: « Pause » and « Reprendre », persisted in Redis. */
  async setBackfill(input: {
    paused: boolean;
    actorId: string;
  }): Promise<BackfillView | null> {
    if (input.paused) await this.backfill.pause();
    else await this.backfill.resume();
    await this.journal.record({
      actorId: input.actorId,
      kind: input.paused ? 'backfill_paused' : 'backfill_resumed',
      target: 'stats_backfill',
    });
    return this.backfillView();
  }

  private queueOf(key: string): { key: ConsoleQueueKey; queue: Queue } {
    const entry = CONSOLE_QUEUES.find((q) => q.key === key);
    const queue = entry ? this.queue(entry.queue) : null;
    if (!entry || !queue) throw new BadRequestException('File inconnue');
    return { key: entry.key, queue };
  }

  private queue(name: string): Queue | null {
    try {
      return this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
    } catch {
      return null;
    }
  }

  private async read(key: ConsoleQueueKey): Promise<QueueReading | null> {
    const entry = CONSOLE_QUEUES.find((q) => q.key === key);
    const queue = entry ? this.queue(entry.queue) : null;
    if (!queue) return null;
    try {
      const [paused, failed, running, done, schedulers] = await Promise.all([
        queue.isPaused(),
        queue.getJobs(['failed'], 0, FAILED_READ - 1),
        queue.getJobs(['active', 'waiting'], 0, 9),
        queue.getJobs(['completed'], 0, 0),
        queue.getJobSchedulers().catch(() => []),
      ]);
      const next = schedulers
        .map((s) => s.next ?? null)
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b)[0];
      return {
        key,
        paused,
        failed: failed.map((job) => ({
          finishedAt: job.finishedOn ?? null,
          reason: job.failedReason ?? null,
        })),
        running: running.map((job) => ({
          since: job.processedOn ?? job.timestamp,
        })),
        lastDoneAt: done[0]?.finishedOn ?? null,
        nextAt: next ?? null,
      };
    } catch (err) {
      logger.warn({ err, key }, 'Queue unreadable');
      return null;
    }
  }

  private async oddsArchiveView(): Promise<OddsArchiveView | null> {
    try {
      return await this.oddsArchive.summary();
    } catch (err) {
      logger.warn({ err }, 'Odds archive unreadable');
      return null;
    }
  }

  private async backfillView(): Promise<BackfillView | null> {
    try {
      const [status, lastPause] = await Promise.all([
        this.backfill.getStatus(),
        this.journal.latest('backfill_paused'),
      ]);
      return {
        paused: status.paused,
        pausedSince: status.paused ? (lastPause?.at ?? null) : null,
        pausedBy: status.paused ? (lastPause?.actor ?? null) : null,
        completedSeasons: status.totals.completedSeasons,
        seasons: status.totals.seasons,
        pending: status.totals.pending,
        events: status.events,
        quota: status.quota
          ? { used: status.quota.current, limit: status.quota.limitDay }
          : null,
        reserve: status.reserve,
      };
    } catch (err) {
      logger.warn({ err }, 'Stats backfill status unreadable');
      return null;
    }
  }
}

export type { QueueView };
