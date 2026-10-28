import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types';
import { AuthService } from './auth.service';
import { ActivityService } from '@modules/activity/activity.service';

@Injectable()
export class AuthSessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly activity: ActivityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.authService.readSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    request.authSession = session;
    // Un jour actif pour la mesure de fidélisation (une écriture par jour).
    this.activity.touch(session.user.id);
    return true;
  }
}
