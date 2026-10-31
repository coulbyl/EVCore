import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@evcore/db';
import type { StorageService } from '@modules/storage/storage.service';
import { AccountDeletionService } from './account-deletion.service';
import type { AccountRepository } from './account.repository';
import { SessionCache } from './session-cache';
import { hashPassword } from './auth.utils';

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword('correct-horse-battery');
});

function makeHarness(role: UserRole = UserRole.OPERATOR) {
  const repository = {
    findCredentials: vi.fn().mockResolvedValue({ passwordHash, role }),
    findAttachmentKeys: vi.fn().mockResolvedValue(['support/a.jpg']),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountRepository;
  const storage = {
    deleteObject: vi.fn().mockResolvedValue(undefined),
  } as unknown as StorageService;
  const sessionCache = new SessionCache();
  vi.spyOn(sessionCache, 'invalidateUser');
  return {
    service: new AccountDeletionService(repository, storage, sessionCache),
    repository,
    storage,
    sessionCache,
  };
}

describe('AccountDeletionService.deleteAccount', () => {
  it('deletes the account, then its stored attachments', async () => {
    const { service, repository, storage, sessionCache } = makeHarness();
    await service.deleteAccount('user-1', 'correct-horse-battery');
    expect(repository.deleteUser).toHaveBeenCalledWith('user-1');
    expect(sessionCache.invalidateUser).toHaveBeenCalledWith('user-1');
    expect(storage.deleteObject).toHaveBeenCalledWith('support/a.jpg');
  });

  it('refuses a wrong password with a 400, deleting nothing', async () => {
    const { service, repository } = makeHarness();
    await expect(
      service.deleteAccount('user-1', 'wrong-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.deleteUser).not.toHaveBeenCalled();
  });

  it('refuses to delete an admin account from the app', async () => {
    const { service, repository } = makeHarness(UserRole.ADMIN);
    await expect(
      service.deleteAccount('admin-1', 'correct-horse-battery'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.deleteUser).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that no longer exists', async () => {
    const { service, repository } = makeHarness();
    vi.mocked(repository.findCredentials).mockResolvedValue(null);
    await expect(
      service.deleteAccount('ghost', 'correct-horse-battery'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
