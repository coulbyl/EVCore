import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@evcore/db';
import type { UnitMode } from '@evcore/db';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import type { Response } from 'express';
import { PrismaService } from '@/prisma.service';
import { MailService } from '@modules/mail/mail.service';
import { createLogger } from '@utils/logger';

const logger = createLogger('auth-service');
import {
  AUTH_SESSION_TTL_MS,
  OTP_CODE_TTL_MS,
  OTP_EXPIRES_IN_MINUTES,
  OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_EXPIRES_IN_MINUTES,
  PASSWORD_RESET_RATE_LIMIT_MAX,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
  PASSWORD_RESET_TTL_MS,
} from './auth.constants';
import type {
  AuthSession,
  AuthSessionUser,
  AuthenticatedRequest,
} from './auth.types';
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  decryptTotpSecret,
  encryptTotpSecret,
  generateOtpCode,
  generateResetToken,
  generateSessionToken,
  hashOtpCode,
  hashPassword,
  hashResetToken,
  hashSessionToken,
  normalizeIdentifier,
  parseCookieHeader,
  verifyPassword,
} from './auth.utils';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateMeDto } from './dto/update-me.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ConfirmTotpDto } from './dto/confirm-totp.dto';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { ResetPasswordTotpDto } from './dto/reset-password-totp.dto';
import type { UpdateIdentityDto } from './dto/update-identity.dto';

const totp = new OTP();

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(
    input: RegisterDto,
  ): Promise<{ token: string; session: AuthSession }> {
    const email = normalizeIdentifier(input.email);
    const username = normalizeIdentifier(input.username);

    const existing = await this.prisma.client.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email ou username déjà utilisé');
    }

    const user = await this.prisma.client.user.create({
      data: {
        email,
        username,
        fullName: input.fullName.trim(),
        passwordHash: hashPassword(input.password),
        bio: input.bio?.trim() || null,
      },
      select: {
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
      },
    });

    const { token, session } = await this.createSession(user.id);
    return {
      token,
      session: {
        sessionId: session.id,
        user: this.toSessionUser(user),
      },
    };
  }

  async login(
    input: LoginDto,
  ): Promise<{ token: string; session: AuthSession }> {
    const identifier = normalizeIdentifier(input.identifier);
    const user = await this.prisma.client.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
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
        passwordHash: true,
      },
    });

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const { token, session } = await this.createSession(user.id);
    return {
      token,
      session: {
        sessionId: session.id,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          bio: user.bio,
          role: user.role,
          emailVerified: user.emailVerified,
          mfaMethod: user.mfaMethod,
          totpVerified: user.totpVerified,
          avatarUrl: user.avatarUrl,
          theme: user.theme,
          locale: user.locale,
          currency: user.currency,
          unitMode: user.unitMode,
          unitAmount: user.unitAmount?.toString() ?? null,
          unitPercent: user.unitPercent?.toString() ?? null,
        },
      },
    };
  }

  async logout(request: AuthenticatedRequest): Promise<void> {
    const token = this.extractSessionToken(request);
    if (!token) return;
    await this.prisma.client.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  async readSessionFromRequest(
    request: AuthenticatedRequest,
  ): Promise<AuthSession | null> {
    const token = this.extractSessionToken(request);
    if (!token) return null;

    const row = await this.prisma.client.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
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
          },
        },
      },
    });

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return {
      sessionId: row.id,
      user: this.toSessionUser(row.user),
    };
  }

  applySessionCookie(response: Response, token: string): void {
    response.setHeader(
      'Set-Cookie',
      buildSessionCookie(token, process.env.NODE_ENV === 'production'),
    );
  }

  clearSessionCookie(response: Response): void {
    response.setHeader(
      'Set-Cookie',
      buildExpiredSessionCookie(process.env.NODE_ENV === 'production'),
    );
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<AuthSessionUser> {
    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.unitMode !== undefined && { unitMode: dto.unitMode }),
        ...(dto.unitAmount !== undefined && {
          unitAmount: new Prisma.Decimal(dto.unitAmount),
        }),
        ...(dto.unitPercent !== undefined && {
          unitPercent: new Prisma.Decimal(dto.unitPercent),
        }),
      },
      select: {
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
      },
    });
    return this.toSessionUser(user);
  }

  async sendEmailVerification(userId: string): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, username: true, emailVerified: true },
    });

    if (user.emailVerified) {
      throw new BadRequestException('Email déjà vérifié');
    }

    await this.prisma.client.emailVerificationCode.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    const code = generateOtpCode();
    await this.prisma.client.emailVerificationCode.create({
      data: {
        userId,
        codeHash: hashOtpCode(code),
        expiresAt: new Date(Date.now() + OTP_CODE_TTL_MS),
      },
    });

    await this.mail.sendEmailVerification(user.email, {
      username: user.username,
      code,
      expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
    });
  }

  async verifyEmail(userId: string, dto: VerifyEmailDto): Promise<void> {
    const codeHash = hashOtpCode(dto.code);
    const record = await this.prisma.client.emailVerificationCode.findFirst({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Code expiré ou invalide');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Trop de tentatives — demandez un nouveau code',
      );
    }

    if (record.codeHash !== codeHash) {
      await this.prisma.client.emailVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Code incorrect');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.emailVerificationCode.update({
        where: { id: record.id },
        data: { used: true },
      }),
      this.prisma.client.user.update({
        where: { id: userId },
        data: { emailVerified: true, mfaMethod: 'EMAIL' },
      }),
    ]);
  }

  async setupTotp(
    userId: string,
  ): Promise<{ qrDataUrl: string; secret: string }> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, totpVerified: true },
    });

    if (user.totpVerified) {
      throw new BadRequestException('Authenticator app déjà configurée');
    }

    const secret = totp.generateSecret();
    const appSecret = this.config.getOrThrow<string>('TOTP_APP_SECRET');
    const encryptedSecret = encryptTotpSecret(secret, appSecret);

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { totpSecret: encryptedSecret },
    });

    const otpauth = totp.generateURI({
      issuer: 'EVCore',
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    return { qrDataUrl, secret };
  }

  async confirmTotp(userId: string, dto: ConfirmTotpDto): Promise<void> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { totpSecret: true, totpVerified: true },
    });

    if (user.totpVerified) {
      throw new BadRequestException('Authenticator app déjà configurée');
    }

    if (!user.totpSecret) {
      throw new BadRequestException("Configurez d'abord l'authenticator app");
    }

    const appSecret = this.config.getOrThrow<string>('TOTP_APP_SECRET');
    const plainSecret = decryptTotpSecret(user.totpSecret, appSecret);
    const result = totp.verifySync({ token: dto.code, secret: plainSecret });

    if (!result.valid) {
      throw new BadRequestException('Code TOTP invalide');
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { totpVerified: true, mfaMethod: 'TOTP' },
    });
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const identifier = normalizeIdentifier(dto.identifier);
    const user = await this.prisma.client.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        totpVerified: true,
        mfaMethod: true,
      },
    });

    if (!user) {
      logger.debug(
        { identifier },
        'password-reset: identifier not found, silently ignored',
      );
      return;
    }

    const windowStart = new Date(
      Date.now() - PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    );
    const recentCount = await this.prisma.client.passwordResetToken.count({
      where: {
        userId: user.id,
        isAdminGenerated: false,
        createdAt: { gt: windowStart },
      },
    });

    if (recentCount >= PASSWORD_RESET_RATE_LIMIT_MAX) {
      logger.warn(
        { userId: user.id, username: user.username, recentCount },
        'password-reset: rate limit reached',
      );
      return;
    }

    const { resetUrl } = await this.createResetToken(user.id, false);

    await this.mail.sendPasswordReset(user.email, {
      username: user.username,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
      isAdminGenerated: false,
    });

    logger.info(
      { userId: user.id, username: user.username },
      'password-reset: email sent',
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashResetToken(dto.token);
    const record = await this.prisma.client.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, used: true },
    });

    if (!record || record.used || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Lien invalide ou expiré');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.passwordResetToken.update({
        where: { id: record.id },
        data: { used: true },
      }),
      this.prisma.client.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(dto.newPassword) },
      }),
      this.prisma.client.session.deleteMany({
        where: { userId: record.userId },
      }),
    ]);
  }

  async resetPasswordWithTotp(dto: ResetPasswordTotpDto): Promise<void> {
    const identifier = normalizeIdentifier(dto.identifier);
    const user = await this.prisma.client.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: { id: true, totpSecret: true, totpVerified: true },
    });

    if (!user || !user.totpVerified || !user.totpSecret) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const appSecret = this.config.getOrThrow<string>('TOTP_APP_SECRET');
    const plainSecret = decryptTotpSecret(user.totpSecret, appSecret);
    const result = totp.verifySync({
      token: dto.totpCode,
      secret: plainSecret,
    });

    if (!result.valid) {
      throw new UnauthorizedException('Code TOTP invalide');
    }

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(dto.newPassword) },
      }),
      this.prisma.client.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);
  }

  async updateIdentity(
    userId: string,
    dto: UpdateIdentityDto,
  ): Promise<AuthSessionUser> {
    const email = dto.email ? normalizeIdentifier(dto.email) : undefined;
    const username = dto.username
      ? normalizeIdentifier(dto.username)
      : undefined;

    if (email !== undefined || username !== undefined) {
      const conflicts = await this.prisma.client.user.findFirst({
        where: {
          AND: [
            { NOT: { id: userId } },
            {
              OR: [
                ...(email !== undefined ? [{ email }] : []),
                ...(username !== undefined ? [{ username }] : []),
              ],
            },
          ],
        },
        select: { email: true, username: true },
      });

      if (conflicts) {
        if (email !== undefined && conflicts.email === email) {
          throw new ConflictException('Cet email est déjà utilisé');
        }
        throw new ConflictException("Ce nom d'utilisateur est déjà utilisé");
      }
    }

    const current = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, mfaMethod: true },
    });

    const emailChanged = email !== undefined && email !== current.email;
    const shouldResetVerification =
      emailChanged && current.mfaMethod === 'EMAIL';

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...(email !== undefined && { email }),
        ...(username !== undefined && { username }),
        ...(shouldResetVerification && {
          emailVerified: false,
          mfaMethod: null,
        }),
      },
      select: {
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
      },
    });

    return this.toSessionUser(user);
  }

  async generateAdminResetLink(userId: string): Promise<string> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const { resetUrl } = await this.createResetToken(userId, true);
    return resetUrl;
  }

  private async createResetToken(
    userId: string,
    isAdminGenerated: boolean,
  ): Promise<{ token: string; resetUrl: string }> {
    const token = generateResetToken();
    await this.prisma.client.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        isAdminGenerated,
      },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    return { token, resetUrl };
  }

  private extractSessionToken(request: AuthenticatedRequest): string | null {
    const cookies = parseCookieHeader(request.headers.cookie);
    return cookies.evcore_session ?? null;
  }

  private async createSession(userId: string) {
    const token = generateSessionToken();
    const session = await this.prisma.client.session.create({
      data: {
        userId,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_MS),
      },
      select: { id: true },
    });

    return { token, session };
  }

  private toSessionUser(user: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    bio: string | null;
    role: AuthSessionUser['role'];
    emailVerified: boolean;
    mfaMethod: AuthSessionUser['mfaMethod'];
    totpVerified: boolean;
    avatarUrl: string | null;
    theme: string | null;
    locale: string | null;
    currency: string | null;
    unitMode: UnitMode | null;
    unitAmount: Prisma.Decimal | null;
    unitPercent: Prisma.Decimal | null;
  }): AuthSessionUser {
    return {
      ...user,
      unitAmount: user.unitAmount?.toString() ?? null,
      unitPercent: user.unitPercent?.toString() ?? null,
    };
  }
}
