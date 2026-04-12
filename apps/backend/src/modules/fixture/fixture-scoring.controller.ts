import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { FixtureScoringService } from './fixture-scoring.service';
import { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';

@Controller('fixture')
@UseGuards(AuthSessionGuard)
export class FixtureScoringController {
  constructor(private readonly service: FixtureScoringService) {}

  @Get()
  getFixtures(
    @CurrentSession() session: AuthSession,
    @Query() query: FixtureScoringQueryDto,
  ) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());

    return this.service.getFixtures(
      date,
      {
        decision: query.decision,
        status: query.status,
        competition: query.competition,
        timeSlot: query.timeSlot,
        betStatus: query.betStatus,
      },
      session.user.id,
    );
  }
}
