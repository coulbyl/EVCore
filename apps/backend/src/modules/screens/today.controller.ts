import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PausedGuard } from '@/common/guards/paused.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { TodayService } from './today.service';
import type { TodayScreen } from './today.types';

/**
 * The « Aujourd'hui » screen. It shows coupons, so the pause closes it like
 * every suggestion (PausedGuard at class level); the web shows the pause
 * from the session instead of calling.
 */
@ApiTags('screens')
@Controller('today')
@UseGuards(AuthSessionGuard, PausedGuard)
export class TodayController {
  constructor(private readonly today: TodayService) {}

  @Get()
  @ApiOperation({
    summary: "The « Aujourd'hui » screen in one answer",
    description:
      "Yesterday's line, today's coupons in screen order, the products that abstained and why, the followed coupons still running, and each product's 30-day form.",
  })
  @ApiOkResponse({ description: 'The screen.' })
  getToday(@CurrentSession() session: AuthSession): Promise<TodayScreen> {
    return this.today.getToday(session.user.id);
  }
}
