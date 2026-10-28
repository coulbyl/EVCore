import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

function sameToken(provided: string, expected: string): boolean {
  // Empreintes de même longueur : la comparaison ne révèle pas la taille.
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Routes d'exploitation (ETL, analyse, backtest, risque) : une session admin,
 * ou le jeton de service `ADMIN_API_TOKEN` dans l'en-tête `x-admin-token`
 * pour les appels curl des procédures (ETL_PLAYBOOK.md). Sans variable,
 * seule la session admin passe. Avant le 2026-10-28 ces routes n'avaient
 * aucun garde sur une API publique.
 */
@Injectable()
export class AdminOrServiceTokenGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const expected = this.config.get<string>('ADMIN_API_TOKEN');
    const provided = request.headers[ADMIN_TOKEN_HEADER];
    if (expected && typeof provided === 'string' && provided.length > 0) {
      if (sameToken(provided, expected)) return true;
      throw new UnauthorizedException('Jeton de service invalide');
    }

    const session = await this.authService.readSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    request.authSession = session;
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
