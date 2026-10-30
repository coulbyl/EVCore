import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import type {
  AdminUserRecord,
  AdminUsersRepository,
} from './admin-users.repository';
import { SessionCache } from '@modules/auth/session-cache';

const RECORD: AdminUserRecord = {
  id: 'user-2',
  email: 'b@example.com',
  username: 'b',
  fullName: 'B',
  role: 'OPERATOR',
  emailVerified: true,
  avatarUrl: null,
  locale: null,
  currency: null,
  suspended: false,
  suspendedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-02T00:00:00.000Z'),
};

function makeHarness(exists = true) {
  const repository = {
    listPage: vi.fn().mockResolvedValue({ total: 1, users: [RECORD] }),
    exists: vi.fn().mockResolvedValue(exists),
    update: vi.fn().mockResolvedValue(RECORD),
    deleteSessions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as AdminUsersRepository;
  const sessionCache = new SessionCache();
  vi.spyOn(sessionCache, 'invalidateUser');
  return {
    service: new AdminUsersService(repository, sessionCache),
    repository,
    sessionCache,
  };
}

describe('AdminUsersService', () => {
  it('lists a page with the trimmed search and role filter', async () => {
    const { service, repository } = makeHarness();
    const page = await service.listUsers({
      page: 3,
      pageSize: 10,
      q: '  bob ',
      role: 'ADMIN',
    });
    expect(repository.listPage).toHaveBeenCalledWith({
      filter: { q: 'bob', role: 'ADMIN' },
      skip: 20,
      take: 10,
    });
    expect(page.items[0]?.createdAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('suspending a user signs them out everywhere', async () => {
    const { service, repository, sessionCache } = makeHarness();
    await service.updateUser('user-2', { suspended: true }, 'admin-1');
    expect(sessionCache.invalidateUser).toHaveBeenCalledWith('user-2');
    expect(repository.update).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ suspended: true }),
    );
    expect(repository.deleteSessions).toHaveBeenCalledWith('user-2');
  });

  it('a failed session revocation still drops the cached session', async () => {
    const { service, repository, sessionCache } = makeHarness();
    vi.mocked(repository.deleteSessions).mockRejectedValueOnce(
      new Error('pool timeout'),
    );
    await expect(
      service.updateUser('user-2', { suspended: true }, 'admin-1'),
    ).rejects.toThrow('pool timeout');
    expect(sessionCache.invalidateUser).toHaveBeenCalledWith('user-2');
  });

  it('a role change keeps the sessions', async () => {
    const { service, repository, sessionCache } = makeHarness();
    await service.updateUser('user-2', { role: 'ADMIN' }, 'admin-1');
    expect(repository.deleteSessions).not.toHaveBeenCalled();
    // The new role reaches the user's open sessions on their next request.
    expect(sessionCache.invalidateUser).toHaveBeenCalledWith('user-2');
  });

  it('an admin cannot suspend or delete their own account', async () => {
    const { service, repository } = makeHarness();
    await expect(
      service.updateUser('admin-1', { suspended: true }, 'admin-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteUser('admin-1', 'admin-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('an unknown user is a 404', async () => {
    const { service } = makeHarness(false);
    await expect(
      service.updateUser('ghost', { role: 'ADMIN' }, 'admin-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.deleteUser('ghost', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
