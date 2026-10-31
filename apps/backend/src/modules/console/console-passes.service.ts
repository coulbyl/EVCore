import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { CONSOLE_PASSES, type ConsolePassKey } from '@config/console.constants';
import { ETL_SCHEDULER_KEYS } from '@config/etl.constants';
import { EtlService } from '@modules/etl/etl.service';
import { formatDateUtc } from '@utils/date.utils';
import { passesOf, type PassJob, type PassView } from './console-passes';

const DAY_MS = 24 * 60 * 60 * 1000;
// The last jobs of a queue: enough for a day (completed jobs keep 100).
const JOBS_READ = 300;

function toPassJob(job: Job, state: PassJob['state']): PassJob {
  return {
    name: job.name,
    state,
    createdAt: job.timestamp,
    startedAt: job.processedOn ?? null,
    finishedAt: job.finishedOn ?? null,
    failedReason: job.failedReason ?? null,
  };
}

/**
 * « Les passes d'aujourd'hui » and « Relancer » (12-admin.md § 1, § 6): the
 * day's passes read from their queues, a relaunch adding the same job the
 * schedule adds. The heavy catch-ups stay commands, never buttons.
 */
@Injectable()
export class ConsolePassesService {
  private readonly queues: ReadonlyMap<string, Queue>;

  // eslint-disable-next-line max-params -- NestJS constructor injection: one queue per pass, and the ETL for its triggers
  constructor(
    private readonly etl: EtlService,
    @InjectQueue('league-sync') leagueSync: Queue,
    @InjectQueue('odds-prematch-sync') odds: Queue,
    @InjectQueue('slip-digest') digest: Queue,
    @InjectQueue('rolling-horizon') horizon: Queue,
    @InjectQueue('vantage-analysis') vantage: Queue,
    @InjectQueue('betting-engine') engine: Queue,
  ) {
    this.queues = new Map([
      ['league-sync', leagueSync],
      ['odds-prematch-sync', odds],
      ['slip-digest', digest],
      ['rolling-horizon', horizon],
      ['vantage-analysis', vantage],
      ['betting-engine', engine],
    ]);
  }

  async getPasses(now: Date = new Date()): Promise<PassView[]> {
    const jobs = new Map<string, PassJob[]>();
    await Promise.all(
      [...this.queues].map(async ([name, queue]) => {
        const [completed, failed, active] = await Promise.all([
          queue.getJobs(['completed'], 0, JOBS_READ),
          queue.getJobs(['failed'], 0, JOBS_READ),
          // Queued and not started yet counts as running: a second
          // Relancer would only queue it twice. Never `delayed`: that is
          // the schedule's next occurrence, not a run.
          queue.getJobs(['active', 'waiting'], 0, JOBS_READ),
        ]);
        jobs.set(name, [
          ...completed.map((j) => toPassJob(j, 'completed')),
          ...failed.map((j) => toPassJob(j, 'failed')),
          ...active.map((j) => toPassJob(j, 'active')),
        ]);
      }),
    );
    return passesOf({ now, jobs });
  }

  /**
   * Adds the pass's job again. Refused for the morning brief (it writes to
   * every player) and while the pass runs.
   */
  async relaunch(key: string, now: Date = new Date()): Promise<PassView> {
    const pass = CONSOLE_PASSES.find((p) => p.key === key);
    if (!pass) throw new BadRequestException('Passe inconnue');
    const before = (await this.getPasses(now)).find((p) => p.key === key);
    if (!pass.relaunch || !before?.canRelaunch) {
      throw new ConflictException('Cette passe ne se relance pas maintenant');
    }
    await this.launch(pass.key, now);
    const after = (await this.getPasses(now)).find((p) => p.key === key);
    return after ?? before;
  }

  private async launch(key: ConsolePassKey, now: Date): Promise<void> {
    switch (key) {
      case 'stats':
        return this.etl.triggerStatsSync();
      case 'odds_morning':
      case 'odds_evening':
        return this.etl.triggerOddsPrematchSync();
      case 'analysis':
        return this.etl.triggerBettingEngineAnalysis();
      case 'coupons': {
        // The same job as the 17:00 schedule: odds, analysis, generators.
        const queue = this.queues.get('rolling-horizon');
        const scheduler = await queue?.getJobScheduler(
          ETL_SCHEDULER_KEYS.ROLLING_HORIZON,
        );
        await queue?.add('rolling-horizon', scheduler?.template?.data ?? {});
        return;
      }
      case 'ai_combo':
        await this.queues.get('vantage-analysis')?.add('generate-coupons', {
          date: formatDateUtc(new Date(now.getTime() + DAY_MS)),
        });
        return;
      case 'morning_brief':
        return;
    }
  }
}
