import { Controller, Get, Query } from '@nestjs/common';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { FixtureScoringService } from './fixture-scoring.service';
import { FixtureScoringQueryDto } from './dto/fixture-scoring-query.dto';

@Controller('fixture')
export class FixtureScoringController {
  constructor(private readonly service: FixtureScoringService) {}

  @Get()
  getFixtures(@Query() query: FixtureScoringQueryDto) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());

    return this.service.getFixtures(date, {
      decision: query.decision,
      status: query.status,
      competition: query.competition,
      timeSlot: query.timeSlot,
      betStatus: query.betStatus,
    });
  }
}
