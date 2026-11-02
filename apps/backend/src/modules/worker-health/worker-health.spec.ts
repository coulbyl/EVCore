import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import { WORKER_HEARTBEAT } from '@config/worker.constants';
import { WorkerHealthController } from './worker-health.controller';
import { WorkerHealthService } from './worker-health.service';
import { WorkerHeartbeatScheduler } from './worker-heartbeat.scheduler';

/** A Redis double that keeps keys and honours their expiry. */
function fakeRedis(now: () => number) {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    // set(key, value, 'PX', ttl), as the heartbeat calls it.
    set: vi.fn((...[key, value, , ttl]: [string, string, string, number]) => {
      store.set(key, { value, expiresAt: now() + ttl });
      return Promise.resolve('OK');
    }),
    get: vi.fn((key: string) => {
      const row = store.get(key);
      return Promise.resolve(row && row.expiresAt > now() ? row.value : null);
    }),
    del: vi.fn((key: string) => Promise.resolve(store.delete(key) ? 1 : 0)),
  } as unknown as Redis;
}

describe('worker heartbeat → GET /health/worker', () => {
  it('answers 200 after a beat, 503 once three beats are missed', async () => {
    let clock = Date.parse('2026-11-02T12:00:00Z');
    const redis = fakeRedis(() => clock);
    const beat = new WorkerHeartbeatScheduler(redis);
    const controller = new WorkerHealthController(
      new WorkerHealthService(redis),
    );

    await beat.beat(new Date(clock));
    await expect(controller.getWorker()).resolves.toEqual({
      status: 'ok',
      lastBeatAt: '2026-11-02T12:00:00.000Z',
    });

    clock += WORKER_HEARTBEAT.STALE_AFTER_MS + 1;
    await expect(controller.getWorker()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('is down at once when the worker stops', async () => {
    const clock = Date.now();
    const redis = fakeRedis(() => clock);
    const beat = new WorkerHeartbeatScheduler(redis);
    const health = new WorkerHealthService(redis);

    await beat.beat(new Date(clock));
    await beat.onApplicationShutdown();

    await expect(health.read()).resolves.toEqual({ status: 'stale' });
  });

  it('reports stale rather than failing when Redis is unreachable', async () => {
    const redis = {
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as Redis;
    await expect(new WorkerHealthService(redis).read()).resolves.toEqual({
      status: 'stale',
    });
  });
});
