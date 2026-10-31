import { describe, it, expect, vi, beforeAll } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, UserRole } from '@evcore/db';
import type { MailService } from '@modules/mail/mail.service';
import { EmailChangeService, maskEmail } from './email-change.service';
import type { AccountRepository } from './account.repository';
import { SessionCache } from './session-cache';
import { hashOtpCode, hashPassword } from './auth.utils';

let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword('correct-horse-battery');
});

type CodeRow = {
  id: string;
  codeHash: string;
  attempts: number;
  targetEmail: string | null;
};

function makeHarness(
  opts: { taken?: boolean; code?: CodeRow | null; confirmError?: Error } = {},
) {
  const repository = {
    findCredentials: vi
      .fn()
      .mockResolvedValue({ passwordHash, role: UserRole.OPERATOR }),
    findIdentity: vi
      .fn()
      .mockResolvedValue({ email: 'old@exemple.com', fullName: 'Fannan' }),
    isEmailTaken: vi.fn().mockResolvedValue(opts.taken ?? false),
    replaceEmailChangeCode: vi.fn().mockResolvedValue(undefined),
    findActiveEmailChangeCode: vi.fn().mockResolvedValue(opts.code ?? null),
    incrementCodeAttempts: vi.fn().mockResolvedValue(undefined),
    confirmEmailChange: opts.confirmError
      ? vi.fn().mockRejectedValue(opts.confirmError)
      : vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountRepository;
  const mail = {
    sendEmailChangeCode: vi.fn().mockResolvedValue(undefined),
    sendEmailChanged: vi.fn().mockResolvedValue(undefined),
    sendEmailChangeTaken: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailService;
  const sessionCache = new SessionCache();
  vi.spyOn(sessionCache, 'invalidateUser');
  return {
    service: new EmailChangeService(repository, mail, sessionCache),
    repository,
    mail,
    sessionCache,
  };
}

const validCode = (overrides: Partial<CodeRow> = {}): CodeRow => ({
  id: 'code-1',
  codeHash: hashOtpCode('123456'),
  attempts: 0,
  targetEmail: 'new@exemple.com',
  ...overrides,
});

describe('EmailChangeService.request', () => {
  it('sends the code to the new address, normalised', async () => {
    const { service, repository, mail } = makeHarness();
    await service.request('u1', {
      newEmail: '  New@Exemple.com ',
      password: 'correct-horse-battery',
    });
    expect(repository.replaceEmailChangeCode).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', targetEmail: 'new@exemple.com' }),
    );
    expect(mail.sendEmailChangeCode).toHaveBeenCalledWith(
      'new@exemple.com',
      expect.objectContaining({ firstName: 'Fannan', expiresInMinutes: 10 }),
    );
  });

  it('refuses a wrong password with 400, never 401', async () => {
    const { service, mail } = makeHarness();
    await expect(
      service.request('u1', { newEmail: 'new@exemple.com', password: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mail.sendEmailChangeCode).not.toHaveBeenCalled();
  });

  it('refuses the current address', async () => {
    await expect(
      makeHarness().service.request('u1', {
        newEmail: 'old@exemple.com',
        password: 'correct-horse-battery',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers the same for a taken address, warning its owner instead of sending a code', async () => {
    const { service, repository, mail } = makeHarness({ taken: true });
    await expect(
      service.request('u1', {
        newEmail: 'new@exemple.com',
        password: 'correct-horse-battery',
      }),
    ).resolves.toBeUndefined();
    expect(mail.sendEmailChangeTaken).toHaveBeenCalledWith('new@exemple.com');
    expect(mail.sendEmailChangeCode).not.toHaveBeenCalled();
    expect(repository.replaceEmailChangeCode).not.toHaveBeenCalled();
  });
});

describe('EmailChangeService.confirm', () => {
  it('switches the address and warns the old one, masked', async () => {
    const { service, repository, mail, sessionCache } = makeHarness({
      code: validCode(),
    });
    await expect(service.confirm('u1', '123456')).resolves.toEqual({
      email: 'new@exemple.com',
    });
    expect(sessionCache.invalidateUser).toHaveBeenCalledWith('u1');
    expect(repository.confirmEmailChange).toHaveBeenCalledWith({
      codeId: 'code-1',
      userId: 'u1',
      email: 'new@exemple.com',
    });
    expect(mail.sendEmailChanged).toHaveBeenCalledWith('old@exemple.com', {
      firstName: 'Fannan',
      newEmail: 'n***@exemple.com',
    });
  });

  it('counts a wrong code and refuses after five attempts', async () => {
    const wrong = makeHarness({ code: validCode() });
    await expect(wrong.service.confirm('u1', '000000')).rejects.toThrow(
      'Code incorrect.',
    );
    expect(wrong.repository.incrementCodeAttempts).toHaveBeenCalledWith(
      'code-1',
    );

    const exhausted = makeHarness({ code: validCode({ attempts: 5 }) });
    await expect(exhausted.service.confirm('u1', '123456')).rejects.toThrow(
      'Trop de tentatives',
    );
    expect(exhausted.repository.confirmEmailChange).not.toHaveBeenCalled();
  });

  it('refuses when no change code is active (expired, or only a sign-up code)', async () => {
    const { service } = makeHarness({ code: null });
    await expect(service.confirm('u1', '123456')).rejects.toThrow(
      'Code expiré ou invalide.',
    );
  });

  it('turns a race on the unique e-mail into a conflict', async () => {
    const race = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { service, mail } = makeHarness({
      code: validCode(),
      confirmError: race,
    });
    await expect(service.confirm('u1', '123456')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mail.sendEmailChanged).not.toHaveBeenCalled();
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('fannan@exemple.com')).toBe('f***@exemple.com');
  });
});
