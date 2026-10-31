import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AccountPauseService } from './account-pause.service';
import type { AccountRepository } from './account.repository';
import { SessionCache } from './session-cache';

const NOW = new Date('2026-10-28T10:00:00.000Z');

function makeHarness(pausedUntil: Date | null) {
  const repository = {
    findPausedUntil: vi.fn().mockResolvedValue({ pausedUntil }),
    setPausedUntil: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountRepository;
  const sessionCache = new SessionCache();
  vi.spyOn(sessionCache, 'invalidateUser');
  return {
    service: new AccountPauseService(repository, sessionCache),
    repository,
    sessionCache,
  };
}

describe('AccountPauseService.pause', () => {
  it('pauses for the chosen number of days', async () => {
    const { service, repository, sessionCache } = makeHarness(null);
    const result = await service.pause('user-1', 7, NOW);
    // The pause hides bets from the very next request.
    expect(sessionCache.invalidateUser).toHaveBeenCalledWith('user-1');
    expect(result.pausedUntil).toBe('2026-11-04T10:00:00.000Z');
    expect(repository.setPausedUntil).toHaveBeenCalledWith(
      'user-1',
      new Date('2026-11-04T10:00:00.000Z'),
    );
  });

  it('extends a running pause to a later end', async () => {
    const { service, repository } = makeHarness(
      new Date('2026-10-29T10:00:00.000Z'),
    );
    await service.pause('user-1', 30, NOW);
    expect(repository.setPausedUntil).toHaveBeenCalledWith(
      'user-1',
      new Date('2026-11-27T10:00:00.000Z'),
    );
  });

  it('never shortens a running pause', async () => {
    const { service, repository } = makeHarness(
      new Date('2026-11-20T10:00:00.000Z'),
    );
    await expect(service.pause('user-1', 1, NOW)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.setPausedUntil).not.toHaveBeenCalled();
  });

  it('starts a new pause once the previous one is over', async () => {
    const { service, repository } = makeHarness(
      new Date('2026-10-01T10:00:00.000Z'),
    );
    await service.pause('user-1', 1, NOW);
    expect(repository.setPausedUntil).toHaveBeenCalledOnce();
  });
});
