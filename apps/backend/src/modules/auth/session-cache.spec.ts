import { describe, it, expect } from 'vitest';
import {
  SESSION_CACHE_MAX_ENTRIES,
  SESSION_CACHE_TTL_MS,
} from '@config/session-cache.constants';
import type { AuthSession } from './auth.types';
import { SessionCache } from './session-cache';

const NOW = Date.parse('2026-10-30T10:00:00.000Z');
const LATER = new Date(NOW + 24 * 60 * 60_000);

function sessionOf(userId: string, sessionId = `s-${userId}`): AuthSession {
  return {
    sessionId,
    user: { id: userId, theme: null } as AuthSession['user'],
  };
}

function store(
  cache: SessionCache,
  input: { tokenHash: string; userId: string; expires?: Date },
): void {
  cache.set(
    {
      tokenHash: input.tokenHash,
      session: sessionOf(input.userId, input.tokenHash),
      sessionExpiresAt: input.expires ?? LATER,
      ticket: cache.ticket(),
    },
    NOW,
  );
}

describe('SessionCache', () => {
  it('returns what was stored until the TTL runs out', () => {
    const cache = new SessionCache();
    store(cache, { tokenHash: 'h1', userId: 'u1' });
    expect(cache.get('h1', NOW + SESSION_CACHE_TTL_MS - 1)?.sessionId).toBe(
      'h1',
    );
    expect(cache.get('h1', NOW + SESSION_CACHE_TTL_MS)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it('never outlives the session itself', () => {
    const cache = new SessionCache();
    store(cache, {
      tokenHash: 'h1',
      userId: 'u1',
      expires: new Date(NOW + 5_000),
    });
    expect(cache.get('h1', NOW + 4_999)).not.toBeNull();
    expect(cache.get('h1', NOW + 5_000)).toBeNull();
  });

  it('does not store a session that is already over', () => {
    const cache = new SessionCache();
    store(cache, { tokenHash: 'h1', userId: 'u1', expires: new Date(NOW) });
    expect(cache.size).toBe(0);
  });

  it('drops every session of a user, and only theirs', () => {
    const cache = new SessionCache();
    store(cache, { tokenHash: 'phone', userId: 'u1' });
    store(cache, { tokenHash: 'laptop', userId: 'u1' });
    store(cache, { tokenHash: 'other', userId: 'u2' });
    cache.invalidateUser('u1');
    expect(cache.get('phone', NOW)).toBeNull();
    expect(cache.get('laptop', NOW)).toBeNull();
    expect(cache.get('other', NOW)?.sessionId).toBe('other');
  });

  it('drops one session on logout', () => {
    const cache = new SessionCache();
    store(cache, { tokenHash: 'phone', userId: 'u1' });
    store(cache, { tokenHash: 'laptop', userId: 'u1' });
    cache.invalidateToken('phone');
    expect(cache.get('phone', NOW)).toBeNull();
    expect(cache.get('laptop', NOW)).not.toBeNull();
  });

  it('refuses a read that started before an invalidation', () => {
    const cache = new SessionCache();
    const ticket = cache.ticket();
    cache.invalidateUser('u1');
    cache.set(
      {
        tokenHash: 'h1',
        session: sessionOf('u1'),
        sessionExpiresAt: LATER,
        ticket,
      },
      NOW,
    );
    expect(cache.get('h1', NOW)).toBeNull();
  });

  it('keeps a read when only another user or token was invalidated', () => {
    const cache = new SessionCache();
    const ticket = cache.ticket();
    cache.invalidateUser('u2');
    cache.invalidateToken('other-token');
    cache.set(
      {
        tokenHash: 'h1',
        session: sessionOf('u1'),
        sessionExpiresAt: LATER,
        ticket,
      },
      NOW,
    );
    expect(cache.get('h1', NOW)).not.toBeNull();
  });

  it('refuses a read whose own token was logged out meanwhile', () => {
    const cache = new SessionCache();
    const ticket = cache.ticket();
    cache.invalidateToken('h1');
    cache.set(
      {
        tokenHash: 'h1',
        session: sessionOf('u1'),
        sessionExpiresAt: LATER,
        ticket,
      },
      NOW,
    );
    expect(cache.get('h1', NOW)).toBeNull();
  });

  it('refuses reads in flight when its invalidation marks are pruned', () => {
    const cache = new SessionCache();
    const ticket = cache.ticket();
    for (let i = 0; i <= SESSION_CACHE_MAX_ENTRIES; i += 1) {
      cache.invalidateUser(`other-${i}`);
    }
    cache.set(
      {
        tokenHash: 'h1',
        session: sessionOf('u1'),
        sessionExpiresAt: LATER,
        ticket,
      },
      NOW,
    );
    expect(cache.get('h1', NOW)).toBeNull();
    store(cache, { tokenHash: 'h2', userId: 'u1' });
    expect(cache.get('h2', NOW)).not.toBeNull();
  });

  it('hands out copies: a caller cannot change the cached session', () => {
    const cache = new SessionCache();
    store(cache, { tokenHash: 'h1', userId: 'u1' });
    const first = cache.get('h1', NOW);
    if (first) first.user.theme = 'dark';
    expect(cache.get('h1', NOW)?.user.theme).toBeNull();
  });

  it('drops the oldest entry when full', () => {
    const cache = new SessionCache();
    for (let i = 0; i < SESSION_CACHE_MAX_ENTRIES; i += 1) {
      store(cache, { tokenHash: `h${i}`, userId: `u${i}` });
    }
    store(cache, { tokenHash: 'newest', userId: 'new' });
    expect(cache.size).toBe(SESSION_CACHE_MAX_ENTRIES);
    expect(cache.get('h0', NOW)).toBeNull();
    expect(cache.get('newest', NOW)).not.toBeNull();
  });
});
