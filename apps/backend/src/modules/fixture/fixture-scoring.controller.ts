import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { FixtureScoringService } from './fixture-scoring.service';
import { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';

@Controller('fixture')
@UseGuards(AuthSessionGuard)
export class FixtureScoringController {
  constructor(private readonly service: FixtureScoringService) {}

  @Get()
  getFixtures(@Query() query: FixtureScoringQueryDto) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());

    return this.service.getFixtures(
      date,
      {
        status: query.status,
        competition: query.competition,
        timeSlot: query.timeSlot,
        betStatus: query.betStatus,
      },
      {
        cursor: query.cursor,
        limit: query.limit,
      },
    );
  }
}
