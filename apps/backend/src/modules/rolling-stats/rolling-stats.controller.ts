import { BadRequestException, Controller, Param, Post } from '@nestjs/common';
import { RollingStatsService } from './rolling-stats.service';

@Controller('rolling-stats')
export class RollingStatsController {
  constructor(private readonly rollingStatsService: RollingStatsService) {}

  @Post('backfill/:competition/:season')
  async backfillSeason(
    @Param('competition') competition: string,
    @Param('season') season: string,
  ) {
    const competitionCode = competition.toUpperCase();

    const year = Number.parseInt(season, 10);

    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      throw new BadRequestException('season must be a valid year (e.g. 2021)');
    }

    try {
      const result = await this.rollingStatsService.backfillSeasonYear(
        year,
        competitionCode,
      );
      return { status: 'ok', ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(message);
    }
  }

  @Post('backfill-league/:competition')
  async backfillLeague(@Param('competition') competition: string) {
    const competitionCode = competition.toUpperCase();
    try {
      const seasons =
        await this.rollingStatsService.backfillLeague(competitionCode);
      return { status: 'ok', competitionCode, seasons };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(message);
    }
  }

  @Post('backfill-all')
  async backfillAll() {
    const seasons =
      await this.rollingStatsService.backfillAllConfiguredSeasons();
    return { status: 'ok', seasons };
  }
}
