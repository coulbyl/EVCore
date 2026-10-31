import { describe, expect, it } from 'vitest';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';
import {
  AUTH_LOGIN_RATE_LIMIT,
  AUTH_REGISTER_RATE_LIMIT,
} from '@config/rate-limit.constants';
import { AuthController } from './auth.controller';

function limitOf(method: keyof AuthController): {
  limit: unknown;
  ttl: unknown;
} {
  const handler = AuthController.prototype[method];
  return {
    limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler),
    ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, handler),
  };
}

describe('auth rate limits', () => {
  // « Cet e-mail a déjà un compte » dit qu'une adresse est prise : tester une
  // liste d'adresses doit rester lent (2026-10-31).
  it('keeps signups slow per address', () => {
    expect(limitOf('register')).toEqual({
      limit: AUTH_REGISTER_RATE_LIMIT.limit,
      ttl: AUTH_REGISTER_RATE_LIMIT.ttlMs,
    });
  });

  it('keeps the login, its code and the reset by code at the login limit', () => {
    for (const method of [
      'login',
      'loginWithTotp',
      'resetPasswordWithTotp',
    ] as const) {
      expect(limitOf(method)).toEqual({
        limit: AUTH_LOGIN_RATE_LIMIT.limit,
        ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
      });
    }
  });
});
