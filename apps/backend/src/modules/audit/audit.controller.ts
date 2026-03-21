import { Controller, Get, Query } from '@nestjs/common';
import { parseIsoDate, startOfUtcDay } from '@utils/date.utils';
import { AuditService } from './audit.service';
import { AuditFixturesQueryDto } from './dto/audit-fixtures-query.dto';

@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get('fixtures')
  getFixtures(@Query() query: AuditFixturesQueryDto) {
    const date = query.date
      ? parseIsoDate(query.date)
      : startOfUtcDay(new Date());
    return this.service.getFixtures(date);
  }

  @Get('overview')
  getOverview() {
    return this.service.getOverview();
  }
}
