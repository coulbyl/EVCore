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
 * result if anything was invalidated in between.
 */
@Injectable()
export class SessionCache {
  private readonly entries = new Map<string, Entry>();
  private readonly tokensByUser = new Map<string, Set<string>>();
  private invalidations = 0;

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
    return this.invalidations;
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
    if (input.ticket !== this.invalidations) return;
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
    const userId = input.session.user.id;
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
    this.invalidations += 1;
    const tokens = this.tokensByUser.get(userId);
    if (!tokens) return;
    for (const tokenHash of tokens) this.entries.delete(tokenHash);
    this.tokensByUser.delete(userId);
  }

  /** One session: after a logout. */
  invalidateToken(tokenHash: string): void {
    this.invalidations += 1;
    this.remove(tokenHash);
  }

  get size(): number {
    return this.entries.size;
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
