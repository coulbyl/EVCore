import { Injectable } from '@nestjs/common';
import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_CACHE_TTL_MS,
} from '@config/session-cache.constants';
import type { AuthSession } from './auth.types';

type Entry = {
  session: AuthSession;
  userId: string;
  /** Epoch ms after which the entry is ignored. */
  expiresAt: number;
};

/**
 * Sessions read from the database, kept in memory for a short while so a
 * page that fires several API calls costs one session query, not one each.
 *
 * Keyed by the hash of the cookie token (never the token itself). Every
 * write to a user or a session must call `invalidateUser` (or
 * `invalidateToken` for a single logout): a pause, a suspension or a
 * password change takes effect on the very next request.
 *
 * A read that started before an invalidation must not put its result back:
 * take a `ticket()` before querying and pass it to `set`, which drops the
 * result if that user or that token was invalidated in between. Other
 * users' writes do not touch it.
 */
@Injectable()
export class SessionCache {
  private readonly entries = new Map<string, Entry>();
  private readonly tokensByUser = new Map<string, Set<string>>();
  /** Bumped by every invalidation; a ticket is its value at read time. */
  private sequence = 0;
  /** Sequence of the last invalidation, per `user:<id>` and `token:<hash>`. */
  private readonly invalidatedAt = new Map<string, number>();
  /** Tickets below this were taken before `invalidatedAt` was last pruned. */
  private floor = 0;

  get(tokenHash: string, now: number = Date.now()): AuthSession | null {
    const entry = this.entries.get(tokenHash);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.remove(tokenHash);
      return null;
    }
    // A copy: one request mutating its session must not leak into the next.
    return structuredClone(entry.session);
  }

  /** Taken before reading the database; see `set`. */
  ticket(): number {
    return this.sequence;
  }

  set(
    input: {
      tokenHash: string;
      session: AuthSession;
      sessionExpiresAt: Date;
      ticket: number;
    },
    now: number = Date.now(),
  ): void {
    const userId = input.session.user.id;
    if (
      input.ticket < this.floor ||
      (this.invalidatedAt.get(`user:${userId}`) ?? 0) > input.ticket ||
      (this.invalidatedAt.get(`token:${input.tokenHash}`) ?? 0) > input.ticket
    ) {
      return;
    }
    const expiresAt = Math.min(
      now + SESSION_CACHE_TTL_MS,
      input.sessionExpiresAt.getTime(),
    );
    if (expiresAt <= now) return;

    this.remove(input.tokenHash);
    if (this.entries.size >= SESSION_CACHE_MAX_ENTRIES) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.remove(oldest.value);
    }
    this.entries.set(input.tokenHash, {
      session: structuredClone(input.session),
      userId,
      expiresAt,
    });
    const tokens = this.tokensByUser.get(userId) ?? new Set<string>();
    tokens.add(input.tokenHash);
    this.tokensByUser.set(userId, tokens);
  }

  /** Every cached session of this user: after any write to them. */
  invalidateUser(userId: string): void {
    this.markInvalidated(`user:${userId}`);
    const tokens = this.tokensByUser.get(userId);
    if (!tokens) return;
    for (const tokenHash of tokens) this.entries.delete(tokenHash);
    this.tokensByUser.delete(userId);
  }

  /** One session: after a logout. */
  invalidateToken(tokenHash: string): void {
    this.markInvalidated(`token:${tokenHash}`);
    this.remove(tokenHash);
  }

  get size(): number {
    return this.entries.size;
  }

  private markInvalidated(key: string): void {
    this.sequence += 1;
    // Bounded like the entries: past the limit, forget every mark and refuse
    // all reads in flight instead (rare, and only costs one more query).
    if (this.invalidatedAt.size >= SESSION_CACHE_MAX_ENTRIES) {
      this.invalidatedAt.clear();
      this.floor = this.sequence;
    }
    this.invalidatedAt.set(key, this.sequence);
  }

  private remove(tokenHash: string): void {
    const entry = this.entries.get(tokenHash);
    if (!entry) return;
    this.entries.delete(tokenHash);
    const tokens = this.tokensByUser.get(entry.userId);
    tokens?.delete(tokenHash);
    if (tokens?.size === 0) this.tokensByUser.delete(entry.userId);
  }
}
