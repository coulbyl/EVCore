import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { REDIS_CLIENT } from '@/common/redis/redis.tokens';
import { createLogger } from '@utils/logger';
import { AppSettingService } from './app-setting.service';

const logger = createLogger('scheduling-switch');

/** How often the switch is read. */
export const SCHEDULING_SWITCH_INTERVAL_MS = 60_000;
/** The queues the switch paused itself, the only ones it resumes. */
export const SWITCH_PAUSED_KEY = 'evcore:scheduling-switch:paused';

const QUEUE_NAMES = [...Object.values(BULLMQ_QUEUES), SLIP_DIGEST.QUEUE];

/**
 * « Passes planifiées » (12-admin § 4), for an incident: turned off, every
 * backend queue is paused (Redis keeps the pause across restarts), turned
 * back on, the queues it paused resume — never one paused elsewhere (the
 * stats backfill has its own pause). Read every minute.
 *
 * ETL_SCHEDULING_ENABLED=false (a local copy) leaves it idle: nothing is
 * scheduled there anyway.
 */
@Injectable()
export class SchedulingSwitchService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer: NodeJS.Timeout | null = null;

  // eslint-disable-next-line max-params -- NestJS constructor injection: the settings, the queues, Redis, the env guard
  constructor(
    private readonly settings: AppSettingService,
    private readonly moduleRef: ModuleRef,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('ETL_SCHEDULING_ENABLED') === 'false') return;
    void this.apply();
    this.timer = setInterval(
      () => void this.apply(),
      SCHEDULING_SWITCH_INTERVAL_MS,
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async apply(): Promise<void> {
    try {
      if (await this.settings.schedulingEnabled()) {
        await this.resumeOwnPauses();
      } else {
        await this.pauseAll();
      }
    } catch (err) {
      logger.error({ err }, 'scheduling switch could not be applied');
    }
  }

  private async pauseAll(): Promise<void> {
    const paused: string[] = [];
    for (const queue of this.queues()) {
      if (await queue.isPaused()) continue;
      await queue.pause();
      paused.push(queue.name);
    }
    if (paused.length === 0) return;
    await this.redis.sadd(SWITCH_PAUSED_KEY, ...paused);
    logger.warn({ paused }, 'scheduled passes off: queues paused');
  }

  private async resumeOwnPauses(): Promise<void> {
    const names = await this.redis.smembers(SWITCH_PAUSED_KEY);
    if (names.length === 0) return;
    for (const queue of this.queues()) {
      if (names.includes(queue.name)) await queue.resume();
    }
    await this.redis.del(SWITCH_PAUSED_KEY);
    logger.info({ resumed: names }, 'scheduled passes on: queues resumed');
  }

  private queues(): Queue[] {
    return QUEUE_NAMES.flatMap((name) => {
      try {
        return [
          this.moduleRef.get<Queue>(getQueueToken(name), { strict: false }),
        ];
      } catch {
        return [];
      }
    });
  }
}
