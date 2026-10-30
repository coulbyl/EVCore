import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@evcore/db';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import type { Response } from 'express';
import { avatarChoiceFor } from '@evcore/analysis-core';
import { MailService } from '@modules/mail/mail.service';
import { AccountRepository } from './account.repository';
import { AuthRepository, type SessionUserRow } from './auth.repository';
import { SessionCache } from './session-cache';
import { LoginChallenges } from './login-challenges';
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
  TERMS_VERSION,
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
import type { LoginTotpDto } from './dto/login-totp.dto';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateMeDto } from './dto/update-me.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ConfirmTotpDto } from './dto/confirm-totp.dto';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { ResetPasswordTotpDto } from './dto/reset-password-totp.dto';
import type { UpdateIdentityDto } from './dto/update-identity.dto';

const totp = new OTP();

export type LoginResult =
  | { kind: 'session'; token: string; session: AuthSession }
  | { kind: 'totp'; challenge: string };

@Injectable()
export class AuthService {
  // eslint-disable-next-line max-params -- Nest DI constructor.
  constructor(
    private readonly repository: AuthRepository,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly account: AccountRepository,
    private readonly sessionCache: SessionCache,
    private readonly loginChallenges: LoginChallenges,
  ) {}

  async register(
    input: RegisterDto,
  ): Promise<{ token: string; session: AuthSession }> {
    const email = normalizeIdentifier(input.email);

    // Seul l'e-mail peut entrer en collision depuis que le nom d'utilisateur
    // n'est plus demandé (2026-10-30). Le message le dit, comme le veut
    // l'écran d'inscription (11 § 2) : un formulaire d'inscription révèle de
    // toute façon qu'une adresse a un compte, autant que le joueur sache
    // qu'il lui suffit de se connecter.
    if (await this.repository.isEmailTaken(email)) {
      throw new ConflictException('Cet e-mail a déjà un compte');
    }

    const user = await this.repository.createUser({
      email,
      fullName: input.firstName.trim(),
      passwordHash: await hashPassword(input.password),
      // Preuve du consentement : le DTO refuse l'inscription sans les deux
      // cases cochées, on garde la date et la version acceptée.
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      // Schema default is `true` (existing users were already past the
      // point of needing it) — a genuinely new signup must start `false`
      // so the active onboarding wizard actually shows.
      hasCompletedOnboarding: false,
    });

    logger.info({ userId: user.id }, 'register: account created');

    return this.openSession(user);
  }

  /**
   * Right password: a session, or, when the account has an authenticator
   * app, a challenge the six-digit code redeems (`loginWithTotp`). The app
   * protected only the password reset until 2026-10-30.
   */
  async login(input: LoginDto): Promise<LoginResult> {
    const identifier = normalizeIdentifier(input.identifier);
    const user = await this.repository.findLoginUser(identifier);

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }

    this.assertNotSuspended(user);

    if (user.totpVerified) {
      return {
        kind: 'totp',
        challenge: this.loginChallenges.issue(user.id),
      };
    }

    return { kind: 'session', ...(await this.openSession(user)) };
  }

  async loginWithTotp(
    input: LoginTotpDto,
  ): Promise<{ token: string; session: AuthSession }> {
    const userId = this.loginChallenges.begin(input.challenge);
    if (!userId) {
      throw new UnauthorizedException(
        'Code expiré ou trop de tentatives — reconnecte-toi',
      );
    }

    const user = await this.repository.findTotpLoginUser(userId);
    if (!user || !user.totpVerified || !user.totpSecret) {
      throw new UnauthorizedException('Reconnecte-toi');
    }
    this.assertNotSuspended(user);

    const appSecret = this.config.getOrThrow<string>('TOTP_APP_SECRET');
    const { valid } = totp.verifySync({
      token: input.code,
      secret: decryptTotpSecret(user.totpSecret, appSecret),
    });
    if (!valid) {
      this.loginChallenges.fail(userId);
      throw new UnauthorizedException('Code incorrect');
    }

    this.loginChallenges.succeed(input.challenge, userId);
    return this.openSession(user);
  }

  private assertNotSuspended(user: { suspended: boolean }): void {
    if (user.suspended) {
      throw new UnauthorizedException(
        'Compte suspendu — contactez un administrateur.',
      );
    }
  }

  private async openSession(
    user: SessionUserRow,
  ): Promise<{ token: string; session: AuthSession }> {
    const { token, session } = await this.createSession(user.id);
    return {
      token,
      session: {
        sessionId: session.id,
        user: this.toSessionUser(user),
      },
    };
  }

  async logout(request: AuthenticatedRequest): Promise<void> {
    const token = this.extractSessionToken(request);
    if (!token) return;
    const tokenHash = hashSessionToken(token);
    await this.repository.deleteSessionByTokenHash(tokenHash);
    this.sessionCache.invalidateToken(tokenHash);
  }

  async readSessionFromRequest(
    request: AuthenticatedRequest,
  ): Promise<AuthSession | null> {
    const token = this.extractSessionToken(request);
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const cached = this.sessionCache.get(tokenHash);
    if (cached) return cached;

    const ticket = this.sessionCache.ticket();
    const row = await this.repository.findSessionByTokenHash(tokenHash);

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (row.user.suspended) {
      await this.repository.deleteSession(row.id);
      this.sessionCache.invalidateUser(row.user.id);
      return null;
    }

    const session: AuthSession = {
      sessionId: row.id,
      user: this.toSessionUser(row.user),
    };
    this.sessionCache.set({
      tokenHash,
      session,
      sessionExpiresAt: row.expiresAt,
      ticket,
    });
    return session;
  }

  applySessionCookie(response: Response, token: string): void {
    response.setHeader(
      'Set-Cookie',
      buildSessionCookie(token, this.isProduction()),
    );
  }

  clearSessionCookie(response: Response): void {
    response.setHeader(
      'Set-Cookie',
      buildExpiredSessionCookie(this.isProduction()),
    );
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<AuthSessionUser> {
    // L'avatar « Oracle » se mérite (badge Diplômé) : l'écran le verrouille,
    // le serveur aussi depuis le 2026-10-28.
    const requiredBadge = dto.avatarUrl
      ? avatarChoiceFor(dto.avatarUrl)?.requiredBadge
      : undefined;
    if (
      requiredBadge &&
      !(await this.account.hasBadge(userId, requiredBadge))
    ) {
      throw new ForbiddenException(
        'Cet avatar se débloque avec le badge Diplômé.',
      );
    }
    const user = await this.repository.updateSessionUser(userId, {
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
      ...(dto.riskProfile !== undefined && {
        riskProfile: dto.riskProfile,
      }),
      ...(dto.emailSupportNotificationsEnabled !== undefined && {
        emailSupportNotificationsEnabled: dto.emailSupportNotificationsEnabled,
      }),
      ...(dto.morningBriefEnabled !== undefined && {
        morningBriefEnabled: dto.morningBriefEnabled,
      }),
      ...(dto.weeklyStatementEnabled !== undefined && {
        weeklyStatementEnabled: dto.weeklyStatementEnabled,
      }),
      ...(dto.hasSeenOnboarding !== undefined && {
        hasSeenOnboarding: dto.hasSeenOnboarding,
      }),
      ...(dto.hasCompletedOnboarding !== undefined && {
        hasCompletedOnboarding: dto.hasCompletedOnboarding,
      }),
      // Revoking consent clears the stored number rather than keeping an
      // unconsented phone number around — see schema.prisma's own comment
      // on phoneNumberConsentGiven.
      ...(dto.phoneNumberConsentGiven !== undefined && {
        phoneNumberConsentGiven: dto.phoneNumberConsentGiven,
        ...(dto.phoneNumberConsentGiven === false && { phoneNumber: null }),
      }),
      ...(dto.phoneNumber !== undefined &&
        dto.phoneNumberConsentGiven !== false && {
          phoneNumber: dto.phoneNumber,
        }),
    });
    this.sessionCache.invalidateUser(userId);
    return this.toSessionUser(user);
  }

  async sendEmailVerification(userId: string): Promise<void> {
    const user = await this.repository.findEmailVerificationTarget(userId);

    if (user.emailVerified) {
      throw new BadRequestException('Email déjà vérifié');
    }

    const code = generateOtpCode();
    await this.repository.replaceVerificationCode({
      userId,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_CODE_TTL_MS),
    });

    await this.mail.sendEmailVerification(user.email, {
      firstName: user.fullName,
      code,
      expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
    });
  }

  async verifyEmail(userId: string, dto: VerifyEmailDto): Promise<void> {
    const codeHash = hashOtpCode(dto.code);
    const record = await this.repository.findActiveVerificationCode(
      userId,
      new Date(),
    );

    if (!record) {
      throw new BadRequestException('Code expiré ou invalide');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Trop de tentatives — demandez un nouveau code',
      );
    }

    if (record.codeHash !== codeHash) {
      await this.repository.incrementVerificationAttempts(record.id);
      throw new BadRequestException('Code incorrect');
    }

    await this.repository.markEmailVerified({ codeId: record.id, userId });
    this.sessionCache.invalidateUser(userId);
  }

  async setupTotp(
    userId: string,
  ): Promise<{ qrDataUrl: string; secret: string }> {
    const user = await this.repository.findTotpSetupTarget(userId);

    if (user.totpVerified) {
      throw new BadRequestException('Authenticator app déjà configurée');
    }

    const secret = totp.generateSecret();
    const appSecret = this.config.getOrThrow<string>('TOTP_APP_SECRET');
    const encryptedSecret = encryptTotpSecret(secret, appSecret);

    await this.repository.setTotpSecret(userId, encryptedSecret);
    this.sessionCache.invalidateUser(userId);

    const otpauth = totp.generateURI({
      issuer: 'EVCore',
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    return { qrDataUrl, secret };
  }

  async confirmTotp(userId: string, dto: ConfirmTotpDto): Promise<void> {
    const user = await this.repository.findTotpState(userId);

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

    await this.repository.markTotpVerified(userId);
    this.sessionCache.invalidateUser(userId);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<void> {
    const identifier = normalizeIdentifier(dto.identifier);
    const user = await this.repository.findPasswordResetTarget(identifier);

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
    const recentCount = await this.repository.countRecentSelfServiceResets(
      user.id,
      windowStart,
    );

    if (recentCount >= PASSWORD_RESET_RATE_LIMIT_MAX) {
      logger.warn(
        { userId: user.id, recentCount },
        'password-reset: rate limit reached',
      );
      return;
    }

    const { resetUrl } = await this.createResetToken(user.id, false);

    await this.mail.sendPasswordReset(user.email, {
      firstName: user.fullName,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
      isAdminGenerated: false,
    });

    logger.info(
      { userId: user.id },
      'password-reset: token created, email dispatch attempted',
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashResetToken(dto.token);
    const record = await this.repository.findResetToken(tokenHash);

    if (!record || record.used || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Lien invalide ou expiré');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.repository.resetPasswordWithToken({
      resetTokenId: record.id,
      userId: record.userId,
      passwordHash,
    });
    this.sessionCache.invalidateUser(record.userId);
  }

  async resetPasswordWithTotp(dto: ResetPasswordTotpDto): Promise<void> {
    const identifier = normalizeIdentifier(dto.identifier);
    const user = await this.repository.findTotpResetTarget(identifier);

    if (!user || !user.totpVerified || !user.totpSecret) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }

    // Même plafond de mauvais codes que la connexion : ce chemin remplace le
    // mot de passe avec le seul code, il ne doit pas servir à le deviner.
    if (this.loginChallenges.isLockedOut(user.id)) {
      throw new UnauthorizedException(
        "Trop de codes incorrects — réessaie dans un quart d'heure",
      );
    }

    const appSecret = this.config.getOrThrow<string>('TOTP_APP_SECRET');
    const plainSecret = decryptTotpSecret(user.totpSecret, appSecret);
    const result = totp.verifySync({
      token: dto.totpCode,
      secret: plainSecret,
    });

    if (!result.valid) {
      this.loginChallenges.fail(user.id);
      throw new UnauthorizedException('Code TOTP invalide');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.repository.replacePasswordAndRevokeSessions(
      user.id,
      passwordHash,
    );
    this.sessionCache.invalidateUser(user.id);
  }

  async updateIdentity(
    userId: string,
    dto: UpdateIdentityDto,
  ): Promise<AuthSessionUser> {
    const username = dto.username
      ? normalizeIdentifier(dto.username)
      : undefined;

    if (username !== undefined) {
      const taken = await this.repository.isUsernameTaken({
        username,
        exceptUserId: userId,
      });
      if (taken) {
        throw new ConflictException("Ce nom d'utilisateur est déjà utilisé");
      }
    }

    const user = await this.repository.updateSessionUser(userId, {
      ...(username !== undefined && { username }),
    });
    this.sessionCache.invalidateUser(userId);

    return this.toSessionUser(user);
  }

  async generateAdminResetLink(userId: string): Promise<string> {
    if (!(await this.repository.userExists(userId))) {
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
    await this.repository.createResetToken({
      userId,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      isAdminGenerated,
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    return { token, resetUrl };
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private extractSessionToken(request: AuthenticatedRequest): string | null {
    const cookies = parseCookieHeader(request.headers.cookie);
    return cookies.evcore_session ?? null;
  }

  private async createSession(userId: string) {
    const token = generateSessionToken();
    const session = await this.repository.createSession({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_MS),
    });

    return { token, session };
  }

  /**
   * Field by field on purpose: rows read for login or session checks also
   * carry `passwordHash` and `suspended`, and a spread would send them to the
   * client.
   */
  private toSessionUser(user: SessionUserRow): AuthSessionUser {
    return {
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
      riskProfile: user.riskProfile,
      emailSupportNotificationsEnabled: user.emailSupportNotificationsEnabled,
      morningBriefEnabled: user.morningBriefEnabled,
      weeklyStatementEnabled: user.weeklyStatementEnabled,
      hasSeenOnboarding: user.hasSeenOnboarding,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      phoneNumber: user.phoneNumber,
      phoneNumberConsentGiven: user.phoneNumberConsentGiven,
      pausedUntil: user.pausedUntil?.toISOString() ?? null,
    };
  }
}
