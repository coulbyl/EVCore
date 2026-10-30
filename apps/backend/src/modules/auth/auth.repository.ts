import { Injectable } from '@nestjs/common';
import { EmailCodePurpose, Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/**
 * The user fields a session carries (`AuthSessionUser`), selected the same
 * way everywhere a session user is read or returned.
 */
export const SESSION_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  bio: true,
  role: true,
  emailVerified: true,
  mfaMethod: true,
  totpVerified: true,
  avatarUrl: true,
  theme: true,
  locale: true,
  currency: true,
  unitMode: true,
  unitAmount: true,
  unitPercent: true,
  riskProfile: true,
  emailSupportNotificationsEnabled: true,
  morningBriefEnabled: true,
  weeklyStatementEnabled: true,
  hasSeenOnboarding: true,
  hasCompletedOnboarding: true,
  phoneNumber: true,
  phoneNumberConsentGiven: true,
  pausedUntil: true,
} as const satisfies Prisma.UserSelect;

export type SessionUserRow = Prisma.UserGetPayload<{
  select: typeof SESSION_USER_SELECT;
}>;

export type LoginUserRow = SessionUserRow & {
  passwordHash: string;
  suspended: boolean;
};

export type SessionRow = {
  id: string;
  expiresAt: Date;
  user: SessionUserRow & { suspended: boolean };
};

const byIdentifier = (identifier: string): Prisma.UserWhereInput => ({
  OR: [{ email: identifier }, { username: identifier }],
});

/**
 * Identity tables of the auth module: users as seen by authentication,
 * sessions, email verification codes and password reset tokens.
 *
 * Every write to `user` or `session` here changes what a session carries:
 * the service that calls it invalidates the session cache.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Users ---------------------------------------------------------------

  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user !== null;
  }

  createUser(data: Prisma.UserCreateInput): Promise<SessionUserRow> {
    return this.prisma.client.user.create({
      data,
      select: SESSION_USER_SELECT,
    });
  }

  findLoginUser(identifier: string): Promise<LoginUserRow | null> {
    return this.prisma.client.user.findFirst({
      where: byIdentifier(identifier),
      select: { ...SESSION_USER_SELECT, passwordHash: true, suspended: true },
    });
  }

  /** The second step of a login: same row as `findLoginUser`, by id. */
  findTotpLoginUser(
    userId: string,
  ): Promise<(LoginUserRow & { totpSecret: string | null }) | null> {
    return this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        ...SESSION_USER_SELECT,
        passwordHash: true,
        suspended: true,
        totpSecret: true,
      },
    });
  }

  updateSessionUser(
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<SessionUserRow> {
    return this.prisma.client.user.update({
      where: { id: userId },
      data,
      select: SESSION_USER_SELECT,
    });
  }

  async userExists(userId: string): Promise<boolean> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user !== null;
  }

  async isUsernameTaken(input: {
    username: string;
    exceptUserId: string;
  }): Promise<boolean> {
    const user = await this.prisma.client.user.findFirst({
      where: { username: input.username, NOT: { id: input.exceptUserId } },
      select: { id: true },
    });
    return user !== null;
  }

  // --- Sessions ------------------------------------------------------------

  createSession(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return this.prisma.client.session.create({
      data,
      select: { id: true },
    });
  }

  findSessionByTokenHash(tokenHash: string): Promise<SessionRow | null> {
    return this.prisma.client.session.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        user: { select: { ...SESSION_USER_SELECT, suspended: true } },
      },
    });
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { tokenHash } });
  }

  /** Idempotent: parallel requests of a suspended user all land here. */
  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { id: sessionId } });
  }

  // --- Email verification --------------------------------------------------

  findEmailVerificationTarget(userId: string): Promise<{
    email: string;
    fullName: string;
    emailVerified: boolean;
  }> {
    return this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, fullName: true, emailVerified: true },
    });
  }

  /** The new code retires every unused verification code of the user. */
  async replaceVerificationCode(input: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.client.emailVerificationCode.updateMany({
      where: {
        userId: input.userId,
        used: false,
        purpose: EmailCodePurpose.VERIFY,
      },
      data: { used: true },
    });
    await this.prisma.client.emailVerificationCode.create({
      data: {
        userId: input.userId,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  findActiveVerificationCode(
    userId: string,
    now: Date,
  ): Promise<{ id: string; codeHash: string; attempts: number } | null> {
    return this.prisma.client.emailVerificationCode.findFirst({
      where: {
        userId,
        used: false,
        purpose: EmailCodePurpose.VERIFY,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, attempts: true },
    });
  }

  async incrementVerificationAttempts(codeId: string): Promise<void> {
    await this.prisma.client.emailVerificationCode.update({
      where: { id: codeId },
      data: { attempts: { increment: 1 } },
    });
  }

  /** The code is spent and the email marked verified together. */
  async markEmailVerified(input: {
    codeId: string;
    userId: string;
  }): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.emailVerificationCode.update({
        where: { id: input.codeId },
        data: { used: true },
      }),
      this.prisma.client.user.update({
        where: { id: input.userId },
        data: { emailVerified: true, mfaMethod: 'EMAIL' },
      }),
    ]);
  }

  // --- Authenticator app (TOTP) --------------------------------------------

  findTotpSetupTarget(
    userId: string,
  ): Promise<{ email: string; totpVerified: boolean }> {
    return this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, totpVerified: true },
    });
  }

  async setTotpSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { totpSecret: encryptedSecret },
    });
  }

  findTotpState(
    userId: string,
  ): Promise<{ totpSecret: string | null; totpVerified: boolean }> {
    return this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totpSecret: true, totpVerified: true },
    });
  }

  async markTotpVerified(userId: string): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { totpVerified: true, mfaMethod: 'TOTP' },
    });
  }

  findTotpResetTarget(identifier: string): Promise<{
    id: string;
    totpSecret: string | null;
    totpVerified: boolean;
  } | null> {
    return this.prisma.client.user.findFirst({
      where: byIdentifier(identifier),
      select: { id: true, totpSecret: true, totpVerified: true },
    });
  }

  // --- Password reset ------------------------------------------------------

  findPasswordResetTarget(identifier: string): Promise<{
    id: string;
    email: string;
    fullName: string;
  } | null> {
    return this.prisma.client.user.findFirst({
      where: byIdentifier(identifier),
      select: { id: true, email: true, fullName: true },
    });
  }

  countRecentSelfServiceResets(userId: string, since: Date): Promise<number> {
    return this.prisma.client.passwordResetToken.count({
      where: { userId, isAdminGenerated: false, createdAt: { gt: since } },
    });
  }

  async createResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    isAdminGenerated: boolean;
  }): Promise<void> {
    await this.prisma.client.passwordResetToken.create({ data });
  }

  findResetToken(tokenHash: string): Promise<{
    id: string;
    userId: string;
    expiresAt: Date;
    used: boolean;
  } | null> {
    return this.prisma.client.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, used: true },
    });
  }

  /** The token is spent, the password replaced, every session revoked. */
  async resetPasswordWithToken(input: {
    resetTokenId: string;
    userId: string;
    passwordHash: string;
  }): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.passwordResetToken.update({
        where: { id: input.resetTokenId },
        data: { used: true },
      }),
      this.prisma.client.user.update({
        where: { id: input.userId },
        data: { passwordHash: input.passwordHash },
      }),
      this.prisma.client.session.deleteMany({
        where: { userId: input.userId },
      }),
    ]);
  }

  /** The password replaced and every session revoked. */
  async replacePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.client.session.deleteMany({ where: { userId } }),
    ]);
  }
}
