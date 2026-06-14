import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '@/prisma.service';
import { REDIS_CLIENT } from '@common/redis/redis.tokens';

@Injectable()
export class ChatRateLimitService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getUsageRequests(input: {
    userId: string;
    day: Date;
  }): Promise<number> {
    try {
      const count = await this.redis.get(usageKey(input.userId, input.day));
      if (count !== null) return parseInt(count, 10);
    } catch {
      // Redis unavailable — fallback to Postgres
    }
    const row = await this.prisma.client.chatUsage.findUnique({
      where: { userId_day: { userId: input.userId, day: input.day } },
      select: { requests: true },
    });
    return row?.requests ?? 0;
  }

  async incrementUsage(input: {
    userId: string;
    day: Date;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    const key = usageKey(input.userId, input.day);
    const ttl = secondsUntilEndOfDay(input.day);
    try {
      // Atomic INCR + EXPIRE via Lua — avoids a TTL-less key if the process dies between two calls.
      await this.redis.eval(
        `local n = redis.call('INCR', KEYS[1])\nredis.call('EXPIRE', KEYS[1], ARGV[1])\nreturn n`,
        1,
        key,
        String(ttl),
      );
    } catch {
      // Non-critical: Postgres audit is the source of truth
    }
    // Postgres audit — fire and forget
    this.prisma.client.chatUsage
      .upsert({
        where: { userId_day: { userId: input.userId, day: input.day } },
        create: {
          userId: input.userId,
          day: input.day,
          requests: 1,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
        },
        update: {
          requests: { increment: 1 },
          inputTokens: { increment: input.inputTokens },
          outputTokens: { increment: input.outputTokens },
        },
      })
      .catch(() => undefined);
  }
}

function usageKey(userId: string, day: Date): string {
  return `chat:usage:${userId}:${day.toISOString().slice(0, 10)}`;
}

function secondsUntilEndOfDay(day: Date): number {
  const end = new Date(day);
  end.setUTCHours(23, 59, 59, 999);
  return Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));
}
