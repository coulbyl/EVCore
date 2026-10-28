import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminGuard } from '@/common/guards/admin.guard';
import type { AuthenticatedRequest } from './auth.types';
import { AuthSessionGuard } from './auth-session.guard';

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
  private readonly adminGuard = new AdminGuard();

  // Délègue à AuthSessionGuard et AdminGuard : une règle de session changée
  // là-bas vaut aussi pour les routes d'exploitation (revue du lot 2).
  constructor(
    private readonly sessionGuard: AuthSessionGuard,
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

    await this.sessionGuard.canActivate(context);
    return this.adminGuard.canActivate(context);
  }
}
