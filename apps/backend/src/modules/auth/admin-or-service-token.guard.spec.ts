import { describe, it, expect, vi } from 'vitest';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  ADMIN_TOKEN_HEADER,
  AdminOrServiceTokenGuard,
} from './admin-or-service-token.guard';
import type { AuthService } from './auth.service';
import { AuthSessionGuard } from './auth-session.guard';
import type { ActivityService } from '@modules/activity/activity.service';
import { EtlController } from '@modules/etl/etl.controller';
import { StatsBackfillController } from '@modules/etl/stats-backfill.controller';
import { BettingEngineController } from '@modules/betting-engine/betting-engine.controller';
import { ChannelDecisionAdminController } from '@modules/betting-engine/channel-decision-admin.controller';
import { BacktestController } from '@modules/backtest/backtest.controller';
import { RiskController } from '@modules/risk/risk.controller';
import { CouponController } from '@modules/coupon/coupon.controller';

type Role = 'ADMIN' | 'OPERATOR';

function makeGuard(opts: { token?: string; role?: Role | null }) {
  const authService = {
    readSessionFromRequest: vi
      .fn()
      .mockResolvedValue(
        opts.role ? { user: { id: 'u1', role: opts.role } } : null,
      ),
  } as unknown as AuthService;
  const config = {
    get: vi.fn().mockReturnValue(opts.token),
  } as unknown as ConfigService;
  return new AdminOrServiceTokenGuard(
    new AuthSessionGuard(authService, {
      touch: vi.fn(),
    } as unknown as ActivityService),
    config,
  );
}

function contextWith(headers: Record<string, string> = {}): ExecutionContext {
  const request = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminOrServiceTokenGuard', () => {
  it('lets the service token through without a session', async () => {
    const guard = makeGuard({ token: 'secret-token', role: null });
    await expect(
      guard.canActivate(contextWith({ [ADMIN_TOKEN_HEADER]: 'secret-token' })),
    ).resolves.toBe(true);
  });

  it('refuses a wrong token instead of falling back to the session', async () => {
    const guard = makeGuard({ token: 'secret-token', role: 'ADMIN' });
    await expect(
      guard.canActivate(contextWith({ [ADMIN_TOKEN_HEADER]: 'guess' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ignores a token header when no token is configured', async () => {
    const guard = makeGuard({ token: undefined, role: null });
    await expect(
      guard.canActivate(contextWith({ [ADMIN_TOKEN_HEADER]: 'anything' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets an admin session through', async () => {
    const guard = makeGuard({ token: 'secret-token', role: 'ADMIN' });
    await expect(guard.canActivate(contextWith())).resolves.toBe(true);
  });

  it('refuses a player session', async () => {
    const guard = makeGuard({ token: 'secret-token', role: 'OPERATOR' });
    await expect(guard.canActivate(contextWith())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses an anonymous call', async () => {
    const guard = makeGuard({ token: 'secret-token', role: null });
    await expect(guard.canActivate(contextWith())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('operations controllers are guarded as a whole', () => {
  // Avant le 2026-10-28, ETL, analyse, backtest et une partie du risque
  // répondaient sans aucune authentification sur l'API publique.
  it.each([
    EtlController,
    StatsBackfillController,
    BettingEngineController,
    ChannelDecisionAdminController,
    BacktestController,
    RiskController,
  ])('%o carries AdminOrServiceTokenGuard at class level', (controller) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) as
      | unknown[]
      | undefined;
    expect(guards).toContain(AdminOrServiceTokenGuard);
  });

  it.each(['settle', 'settleOne', 'settleRange'] as const)(
    'CouponController.%s carries AdminOrServiceTokenGuard',
    (method) => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        CouponController.prototype[method],
      ) as unknown[] | undefined;
      expect(guards).toContain(AdminOrServiceTokenGuard);
    },
  );
});
