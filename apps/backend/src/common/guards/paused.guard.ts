import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '@modules/auth/auth.types';

/**
 * Bloque ce qui propose un pari pendant la pause du joueur : coupons du
 * jour, Décisions, Avis IA, fiche de match, saisie de coupon, export
 * d'analyse. L'écran ne suffit pas, le serveur fait foi. À placer après
 * AuthSessionGuard, qui charge la session.
 */
@Injectable()
export class PausedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const pausedUntil = request.authSession?.user.pausedUntil;
    if (pausedUntil && new Date(pausedUntil).getTime() > Date.now()) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'ACCOUNT_PAUSED',
        pausedUntil,
        message: 'Tu as choisi une pause : cette page revient à sa fin.',
      });
    }
    return true;
  }
}
