import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { MeSettledQueryDto } from './dto/me-settled-query.dto';
import { MeService } from './me.service';
import type { MeScreen, MeSettledPage } from './me.types';

/**
 * « Moi ». It proposes nothing to play and stays open during a pause
 * (09 § 4): no PausedGuard.
 */
@ApiTags('screens')
@Controller('me')
@UseGuards(AuthSessionGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  @ApiOperation({
    summary: 'The « Moi » screen in one answer',
    description:
      'The record of my followed coupons, those still running, the last 30 settled with a cursor, the unread team replies and the pause.',
  })
  @ApiOkResponse({ description: 'The screen.' })
  getMe(@CurrentSession() session: AuthSession): Promise<MeScreen> {
    return this.me.getMe(session.user);
  }

  @Get('settled')
  @ApiOperation({
    summary: '« Voir plus » under Réglés',
    description: 'The next 30 settled followed coupons after the cursor.',
  })
  @ApiOkResponse({ description: 'One page.' })
  getSettled(
    @CurrentSession() session: AuthSession,
    @Query() query: MeSettledQueryDto,
  ): Promise<MeSettledPage> {
    return this.me.getSettled({
      userId: session.user.id,
      cursor: query.cursor,
    });
  }
}
