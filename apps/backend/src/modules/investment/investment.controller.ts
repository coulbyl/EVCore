import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { InvestmentService, type InvestmentPick } from './investment.service';
import { InvestmentQueryDto } from './dto/investment-query.dto';

@Controller('investments')
@UseGuards(AuthSessionGuard)
export class InvestmentController {
  constructor(private readonly investments: InvestmentService) {}

  @Get()
  list(@Query() query: InvestmentQueryDto): Promise<InvestmentPick[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.investments.listPicks({
      date: query.date ?? today,
      view: query.view ?? 'assumed',
      channel: query.channel,
      competitionCode: query.competitionCode,
    });
  }
}
