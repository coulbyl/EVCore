import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { PausedGuard } from './paused.guard';

function contextFor(pausedUntil: string | null): ExecutionContext {
  const request = { authSession: { user: { pausedUntil } } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PausedGuard', () => {
  const guard = new PausedGuard();

  it('lets a player without a pause through', () => {
    expect(guard.canActivate(contextFor(null))).toBe(true);
  });

  it('lets a player through once the pause is over', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(guard.canActivate(contextFor(past))).toBe(true);
  });

  it('blocks a paused player with ACCOUNT_PAUSED and the end date', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    try {
      guard.canActivate(contextFor(future));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'ACCOUNT_PAUSED',
        pausedUntil: future,
      });
    }
  });
});
