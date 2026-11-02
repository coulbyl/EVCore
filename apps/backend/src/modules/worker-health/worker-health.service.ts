import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/redis/redis.tokens';
import { WORKER_HEARTBEAT } from '@config/worker.constants';

export type WorkerHealth =
  | { status: 'ok'; lastBeatAt: string }
  | { status: 'stale' };

/** Whether the worker process beat recently (WorkerHeartbeatScheduler). */
@Injectable()
export class WorkerHealthService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async read(): Promise<WorkerHealth> {
    // The key expires after STALE_AFTER_MS: present means alive.
    const lastBeatAt = await this.redis
      .get(WORKER_HEARTBEAT.REDIS_KEY)
      .catch(() => null);
    return lastBeatAt ? { status: 'ok', lastBeatAt } : { status: 'stale' };
  }
}
