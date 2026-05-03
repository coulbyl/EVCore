import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@evcore/db';
import type { UnitMode } from '@evcore/db';
import type { Response } from 'express';
import { PrismaService } from '@/prisma.service';
import { AUTH_SESSION_TTL_MS } from './auth.constants';
import type {
  AuthSession,
  AuthSessionUser,
  AuthenticatedRequest,
} from './auth.types';
import {
  buildExpiredSessionCookie,
  buildSessionCookie,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeIdentifier,
  parseCookieHeader,
  verifyPassword,
} from './auth.utils';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
