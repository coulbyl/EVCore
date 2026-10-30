import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '@modules/mail/mail.service';
import { AuthService } from './auth.service';
import type { AccountRepository } from './account.repository';
import type {
  AuthRepository,
  LoginUserRow,
  SessionRow,
  SessionUserRow,
} from './auth.repository';
import type { AuthenticatedRequest } from './auth.types';
import { hashPassword, hashResetToken, hashSessionToken } from './auth.utils';
import { SessionCache } from './session-cache';

const USER: SessionUserRow = {
  id: 'user-1',
  email: 'joueur@example.com',
  username: 'joueur',
  fullName: 'Joueur Un',
  bio: null,
  role: 'OPERATOR',
  emailVerified: true,
  mfaMethod: 'EMAIL',
  totpVerified: false,
  avatarUrl: null,
  theme: null,
  locale: 'fr',
  currency: 'XOF',
  unitMode: null,
  unitAmount: null,
  unitPercent: null,
  riskProfile: 'BALANCED',
  emailSupportNotificationsEnabled: true,
  morningBriefEnabled: true,
  weeklyStatementEnabled: true,
  hasSeenOnboarding: true,
  hasCompletedOnboarding: true,
  phoneNumber: null,
  phoneNumberConsentGiven: false,
  pausedUntil: null,
} as SessionUserRow;

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword('correct horse');
});

function makeHarness(
  overrides: Partial<Record<keyof AuthRepository, unknown>> = {},
) {
  const repository = {
    findLoginUser: vi.fn(),
    createSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
    findSessionByTokenHash: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    deleteSessionByTokenHash: vi.fn().mockResolvedValue(undefined),
    findResetToken: vi.fn(),
    resetPasswordWithToken: vi.fn().mockResolvedValue(undefined),
    isUsernameTaken: vi.fn().mockResolvedValue(false),
    updateSessionUser: vi.fn().mockResolvedValue(USER),
    userExists: vi.fn().mockResolvedValue(true),
    createResetToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AuthRepository;
  const config = {
    get: vi.fn().mockReturnValue('https://app.example'),
    getOrThrow: vi.fn(),
  } as unknown as ConfigService;
  const sessionCache = new SessionCache();
  const service = new AuthService(
    repository,
    {} as MailService,
    config,
    {} as AccountRepository,
    sessionCache,
  );
  return { service, repository, sessionCache };
}

function requestWith(token?: string): AuthenticatedRequest {
  return {
    headers: token ? { cookie: `evcore_session=${token}` } : {},
  } as AuthenticatedRequest;
}

describe('AuthService.login', () => {
  const loginRow = (): LoginUserRow => ({
    ...USER,
    passwordHash,
    suspended: false,
  });

  it('rejects an unknown identifier', async () => {
    const { service } = makeHarness({
      findLoginUser: vi.fn().mockResolvedValue(null),
    });
    await expect(
      service.login({ identifier: 'nobody', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong password', async () => {
    const { service, repository } = makeHarness({
      findLoginUser: vi.fn().mockResolvedValue(loginRow()),
    });
    await expect(
      service.login({ identifier: 'joueur', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('rejects a suspended account even with the right password', async () => {
    const { service, repository } = makeHarness({
      findLoginUser: vi
        .fn()
        .mockResolvedValue({ ...loginRow(), suspended: true }),
    });
    await expect(
      service.login({ identifier: 'joueur', password: 'correct horse' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('opens a session and never returns the password hash', async () => {
    const { service, repository } = makeHarness({
      findLoginUser: vi.fn().mockResolvedValue(loginRow()),
    });
    const { token, session } = await service.login({
      identifier: '  Joueur ',
      password: 'correct horse',
    });
    expect(repository.findLoginUser).toHaveBeenCalledWith('joueur');
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: hashSessionToken(token),
      }),
    );
    expect(session.sessionId).toBe('session-1');
    expect(session.user).not.toHaveProperty('passwordHash');
    expect(session.user).not.toHaveProperty('suspended');
    expect(session.user.email).toBe('joueur@example.com');
  });
});

describe('AuthService.readSessionFromRequest', () => {
  const sessionRow = (patch: Partial<SessionRow> = {}): SessionRow => ({
    id: 'session-1',
    expiresAt: new Date(Date.now() + 60_000),
    user: { ...USER, suspended: false },
    ...patch,
  });

  it('returns null without a cookie and reads nothing', async () => {
    const { service, repository } = makeHarness();
    expect(await service.readSessionFromRequest(requestWith())).toBeNull();
    expect(repository.findSessionByTokenHash).not.toHaveBeenCalled();
  });

  it('looks the session up by the hash of the cookie token', async () => {
    const { service, repository } = makeHarness({
      findSessionByTokenHash: vi.fn().mockResolvedValue(sessionRow()),
    });
    const session = await service.readSessionFromRequest(requestWith('tok'));
    expect(repository.findSessionByTokenHash).toHaveBeenCalledWith(
      hashSessionToken('tok'),
    );
    expect(session?.sessionId).toBe('session-1');
    expect(session?.user).not.toHaveProperty('suspended');
  });

  it('returns null for an expired session', async () => {
    const { service } = makeHarness({
      findSessionByTokenHash: vi
        .fn()
        .mockResolvedValue(sessionRow({ expiresAt: new Date(Date.now() - 1) })),
    });
    expect(await service.readSessionFromRequest(requestWith('tok'))).toBeNull();
  });

  it('deletes the session of a suspended user', async () => {
    const { service, repository } = makeHarness({
      findSessionByTokenHash: vi
        .fn()
        .mockResolvedValue(sessionRow({ user: { ...USER, suspended: true } })),
    });
    expect(await service.readSessionFromRequest(requestWith('tok'))).toBeNull();
    expect(repository.deleteSession).toHaveBeenCalledWith('session-1');
  });
});

describe('AuthService.logout', () => {
  it('deletes the session of the cookie token', async () => {
    const { service, repository } = makeHarness();
    await service.logout(requestWith('tok'));
    expect(repository.deleteSessionByTokenHash).toHaveBeenCalledWith(
      hashSessionToken('tok'),
    );
  });

  it('does nothing without a cookie', async () => {
    const { service, repository } = makeHarness();
    await service.logout(requestWith());
    expect(repository.deleteSessionByTokenHash).not.toHaveBeenCalled();
  });
});

describe('AuthService.resetPassword', () => {
  it('refuses a used token', async () => {
    const { service, repository } = makeHarness({
      findResetToken: vi.fn().mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        used: true,
      }),
    });
    await expect(
      service.resetPassword({ token: 'raw', newPassword: 'new password 1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it('spends the token, replaces the password and revokes sessions', async () => {
    const { service, repository } = makeHarness({
      findResetToken: vi.fn().mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60_000),
        used: false,
      }),
    });
    await service.resetPassword({
      token: 'raw',
      newPassword: 'new password 1',
    });
    expect(repository.findResetToken).toHaveBeenCalledWith(
      hashResetToken('raw'),
    );
    expect(repository.resetPasswordWithToken).toHaveBeenCalledWith(
      expect.objectContaining({ resetTokenId: 'reset-1', userId: 'user-1' }),
    );
  });
});

describe('AuthService.updateIdentity', () => {
  it('refuses a username taken by someone else', async () => {
    const { service, repository } = makeHarness({
      isUsernameTaken: vi.fn().mockResolvedValue(true),
    });
    await expect(
      service.updateIdentity('user-1', { username: 'Pris' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.isUsernameTaken).toHaveBeenCalledWith({
      username: 'pris',
      exceptUserId: 'user-1',
    });
    expect(repository.updateSessionUser).not.toHaveBeenCalled();
  });
});

describe('AuthService.generateAdminResetLink', () => {
  it('refuses an unknown user', async () => {
    const { service } = makeHarness({
      userExists: vi.fn().mockResolvedValue(false),
    });
    await expect(
      service.generateAdminResetLink('ghost'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds the link on the app address', async () => {
    const { service, repository } = makeHarness();
    const link = await service.generateAdminResetLink('user-1');
    expect(link).toMatch(
      /^https:\/\/app\.example\/auth\/reset-password\?token=/,
    );
    expect(repository.createResetToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', isAdminGenerated: true }),
    );
  });
});

describe('AuthService session cache', () => {
  const freshRow = (): SessionRow => ({
    id: 'session-1',
    expiresAt: new Date(Date.now() + 60 * 60_000),
    user: { ...USER, suspended: false },
  });

  it('serves a second read of the same session from memory', async () => {
    const { service, repository } = makeHarness({
      findSessionByTokenHash: vi.fn().mockResolvedValue(freshRow()),
    });
    const first = await service.readSessionFromRequest(requestWith('tok'));
    const second = await service.readSessionFromRequest(requestWith('tok'));
    expect(second).toEqual(first);
    expect(repository.findSessionByTokenHash).toHaveBeenCalledOnce();
  });

  it('a logout ends the cached session at once', async () => {
    const { service, repository } = makeHarness({
      findSessionByTokenHash: vi
        .fn()
        .mockResolvedValueOnce(freshRow())
        .mockResolvedValueOnce(null),
    });
    await service.readSessionFromRequest(requestWith('tok'));
    await service.logout(requestWith('tok'));
    expect(await service.readSessionFromRequest(requestWith('tok'))).toBeNull();
    expect(repository.findSessionByTokenHash).toHaveBeenCalledTimes(2);
  });

  it('a change of preferences is read back on the next request', async () => {
    const dark = freshRow();
    dark.user.theme = 'dark';
    const { service, repository } = makeHarness({
      findSessionByTokenHash: vi
        .fn()
        .mockResolvedValueOnce(freshRow())
        .mockResolvedValueOnce(dark),
    });
    await service.readSessionFromRequest(requestWith('tok'));
    await service.updateMe('user-1', { theme: 'dark' });
    const after = await service.readSessionFromRequest(requestWith('tok'));
    expect(after?.user.theme).toBe('dark');
    expect(repository.findSessionByTokenHash).toHaveBeenCalledTimes(2);
  });

  it('a read that raced a write does not put stale data back', async () => {
    let release: (row: SessionRow) => void = () => undefined;
    const pending = new Promise<SessionRow>((resolve) => {
      release = resolve;
    });
    const { service, repository } = makeHarness({
      findSessionByTokenHash: vi
        .fn()
        .mockReturnValueOnce(pending)
        .mockResolvedValue(freshRow()),
    });
    const racing = service.readSessionFromRequest(requestWith('tok'));
    // The write lands while the read is still waiting on the database.
    await service.updateMe('user-1', { theme: 'dark' });
    release(freshRow());
    await racing;
    await service.readSessionFromRequest(requestWith('tok'));
    expect(repository.findSessionByTokenHash).toHaveBeenCalledTimes(2);
  });
});
