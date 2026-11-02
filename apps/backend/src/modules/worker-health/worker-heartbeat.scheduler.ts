import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/common/redis/redis.tokens';
import { WORKER_HEARTBEAT } from '@config/worker.constants';
import { createLogger } from '@utils/logger';

const logger = createLogger('worker-heartbeat');

/**
 * The worker process says it is alive, every 30 s: a Redis key that
 * expires (read by the API's GET /health/worker) and a file whose age the
 * container healthcheck reads. Its event loop beats, so a pass that blocks
 * it for more than a minute and a half shows as a stale worker too.
 */
@Injectable()
export class WorkerHeartbeatScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onApplicationBootstrap(): void {
    void this.beat();
    this.timer = setInterval(() => void this.beat(), WORKER_HEARTBEAT.BEAT_MS);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    // A stopped worker is down at once, not 90 s later.
    await this.redis.del(WORKER_HEARTBEAT.REDIS_KEY).catch(() => undefined);
  }

  async beat(now: Date = new Date()): Promise<void> {
    try {
      await this.redis.set(
        WORKER_HEARTBEAT.REDIS_KEY,
        now.toISOString(),
        'PX',
        WORKER_HEARTBEAT.STALE_AFTER_MS,
      );
      await writeFile(WORKER_HEARTBEAT.LIVENESS_FILE, now.toISOString());
    } catch (err) {
      logger.warn({ err }, 'worker heartbeat not written');
    }
  }
}
