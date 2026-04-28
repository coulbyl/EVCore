import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { AuditService } from './audit.service';
import { AuditFixturesQueryDto } from './dto/audit-fixtures-query.dto';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { UpdateCompetitionActiveDto } from './dto/update-competition-active.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('fixtures')
  getFixtures(@Query() query: AuditFixturesQueryDto) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());

    return this.service.getFixtures(date, {
      decision: query.decision,
      status: query.status,
      competition: query.competition,
      timeSlot: query.timeSlot,
    });
  }

  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }

  @Patch('competition/:code/active')
  @UseGuards(AuthSessionGuard)
  async updateCompetitionActive(
    @Param('code') code: string,
    @Body() dto: UpdateCompetitionActiveDto,
  ) {
    return this.service.updateCompetitionActive(code, dto.isActive);
  }
}
