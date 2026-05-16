import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { GridSearchService } from './grid-search.service';

@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
    private readonly gridSearchService: GridSearchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  runAll() {
    return this.backtestService.runAllCompetitions();
  }

  // Declared before `:competitionCode` so NestJS matches the static path first.
  @Post('grid-search/:competitionCode')
  @HttpCode(HttpStatus.OK)
  runGridSearch(@Param('competitionCode') competitionCode: string) {
    return this.gridSearchService.runGridSearch(competitionCode);
  }

  @Post('safe-value')
  @HttpCode(HttpStatus.OK)
  runSafeValueBacktest() {
    return this.backtestService.runAllSeasonsSafeValueBacktest();
  }

  @Post(':competitionCode')
  @HttpCode(HttpStatus.OK)
  runCompetition(@Param('competitionCode') competitionCode: string) {
    return this.backtestService.runCompetitionBacktest(competitionCode);
  }

  @Post(':competitionCode/:seasonName')
  @HttpCode(HttpStatus.OK)
  runCompetitionSeason(
    @Param('competitionCode') competitionCode: string,
    @Param('seasonName') seasonName: string,
  ) {
    return this.backtestService.runCompetitionBacktest(
      competitionCode,
      seasonName,
    );
  }
}
