import { Controller, Param, Post } from '@nestjs/common';
import { BettingEngineService } from './betting-engine.service';

@Controller('betting-engine')
export class BettingEngineController {
  constructor(private readonly bettingEngineService: BettingEngineService) {}

  @Post('analyze/fixture/:fixtureId')
  analyzeFixture(@Param('fixtureId') fixtureId: string) {
    return this.bettingEngineService.analyzeFixture(fixtureId);
  }

  @Post('analyze/date/:date')
  analyzeByDate(@Param('date') date: string) {
    return this.bettingEngineService.analyzeByDate(date);
  }

  @Post('analyze/season/:seasonId')
  analyzeSeason(@Param('seasonId') seasonId: string) {
    return this.bettingEngineService.analyzeSeason(seasonId);
  }
}
