import { BadRequestException, Controller, Param, Post } from '@nestjs/common';
import { RollingStatsService } from './rolling-stats.service';
import { getCompetitionByCodeOrThrow } from '@config/etl.constants';

@Controller('rolling-stats')
export class RollingStatsController {
  constructor(private readonly rollingStatsService: RollingStatsService) {}

  @Post('backfill/:competition/:season')
  async backfillSeason(
    @Param('competition') competition: string,
    @Param('season') season: string,
  ) {
    const competitionCode = competition.toUpperCase();
    try {
      getCompetitionByCodeOrThrow(competitionCode);
    } catch {
      throw new BadRequestException(
        `competition must be a known code (received: ${competition})`,
      );
    }

    const year = Number.parseInt(season, 10);

    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      throw new BadRequestException('season must be a valid year (e.g. 2021)');
    }

    const result = await this.rollingStatsService.backfillSeasonYear(
      year,
      competitionCode,
    );
    return { status: 'ok', ...result };
  }

  @Post('backfill-all')
  async backfillAll() {
    const seasons =
      await this.rollingStatsService.backfillAllConfiguredSeasons();
    return { status: 'ok', seasons };
  }
}
