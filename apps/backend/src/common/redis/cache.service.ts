import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.tokens';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      this.logger.warn(`Cache write failed: ${key}`);
    }
  }

  async setWithTags(
    key: string,
    value: unknown,
    opts: { ttl: number; tags: string[] },
  ): Promise<void> {
    await this.set(key, value, opts.ttl);
    for (const tag of opts.tags) {
      try {
        const tagKey = `cache:tag:${tag}`;
        await this.redis.sadd(tagKey, key);
        // Tag set TTL slightly longer than the cached value so the tag outlives the key.
        await this.redis.expire(tagKey, opts.ttl + 120);
      } catch {
        // Non-critical: worst case the tag set grows stale, TTL cleans up the data key.
      }
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    try {
      const tagKey = `cache:tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);
      if (keys.length > 0) {
        await this.redis.del(...keys, tagKey);
      } else {
        await this.redis.del(tagKey);
      }
    } catch {
      // Non-critical: stale data expires via TTL.
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch {
      // Non-critical: stale data expires via TTL.
    }
  }
}
