import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@evcore/db';
import type { StorageService } from '@modules/storage/storage.service';
import { AccountDeletionService } from './account-deletion.service';
import type { AccountDeletionRepository } from './account-deletion.repository';
import { hashPassword } from './auth.utils';

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword('correct-horse-battery');
});

function makeHarness(role: UserRole = UserRole.OPERATOR) {
  const repository = {
    findCredentials: vi.fn().mockResolvedValue({ passwordHash, role }),
    findAttachmentKeys: vi.fn().mockResolvedValue(['support/a.jpg']),
    deleteUserAndOwnBets: vi.fn().mockResolvedValue({ bets: 2 }),
  } as unknown as AccountDeletionRepository;
  const storage = {
    deleteObject: vi.fn().mockResolvedValue(undefined),
  } as unknown as StorageService;
  return {
    service: new AccountDeletionService(repository, storage),
    repository,
    storage,
  };
}

describe('AccountDeletionService.deleteAccount', () => {
  it('deletes the account, its bets, then its stored attachments', async () => {
    const { service, repository, storage } = makeHarness();
    await service.deleteAccount('user-1', 'correct-horse-battery');
    expect(repository.deleteUserAndOwnBets).toHaveBeenCalledWith('user-1');
    expect(storage.deleteObject).toHaveBeenCalledWith('support/a.jpg');
  });

  it('refuses a wrong password with a 400, deleting nothing', async () => {
    const { service, repository } = makeHarness();
    await expect(
      service.deleteAccount('user-1', 'wrong-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.deleteUserAndOwnBets).not.toHaveBeenCalled();
  });

  it('refuses to delete an admin account from the app', async () => {
    const { service, repository } = makeHarness(UserRole.ADMIN);
    await expect(
      service.deleteAccount('admin-1', 'correct-horse-battery'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.deleteUserAndOwnBets).not.toHaveBeenCalled();
  });

  it('answers 404 for an account that no longer exists', async () => {
    const { service, repository } = makeHarness();
    vi.mocked(repository.findCredentials).mockResolvedValue(null);
    await expect(
      service.deleteAccount('ghost', 'correct-horse-battery'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
