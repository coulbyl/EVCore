import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { SummaryService } from './summary.service';
import { SummaryQueryDto } from './dto/summary-query.dto';

@Controller('summary')
@UseGuards(AuthSessionGuard)
export class SummaryController {
  constructor(private readonly service: SummaryService) {}

  @Get()
  getSummary(@Query() query: SummaryQueryDto) {
    return this.service.getSummary(
      query.channel,
      query.period,
      query.from,
      query.to,
    );
  }
}
