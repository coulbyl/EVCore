import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { AuditService } from './audit.service';
import { AuditFixturesQueryDto } from './dto/audit-fixtures-query.dto';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AdminGuard } from '@/common/guards/admin.guard';
import { UpdateCompetitionActiveDto } from './dto/update-competition-active.dto';

// Internal ops tool — exposes model diagnostics (rejection reasons, feature
// snapshots) and lets an operator flip a league's active flag. Admin only;
// never reuse these routes for the public track-record page (see
// docs/formation-content-maintenance.md and the dashboard module instead).
@Controller('audit')
@UseGuards(AuthSessionGuard, AdminGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('fixtures')
  getFixtures(@Query() query: AuditFixturesQueryDto) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());

    return this.service.getFixtures(date, {
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
  async updateCompetitionActive(
    @Param('code') code: string,
    @Body() dto: UpdateCompetitionActiveDto,
  ) {
    return this.service.updateCompetitionActive(code, dto.isActive);
  }
}
