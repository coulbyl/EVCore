import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(AuthSessionGuard)
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('badges/me')
  async myBadges(@CurrentSession() session: AuthSession) {
    await this.gamification.checkAndAwardBadges(session.user.id);
    const badges = await this.gamification.getBadgesForUser(session.user.id);
    return { badges };
  }
}
