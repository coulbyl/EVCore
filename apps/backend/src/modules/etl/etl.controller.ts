import { BadRequestException, Controller, Param, Post } from '@nestjs/common';
import { EtlService } from './etl.service';

@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('sync/full')
  async triggerFullSync() {
    await this.etlService.triggerFullSync();
    return { status: 'ok' as const };
  }

  @Post('sync/odds-historical')
  async triggerOddsHistoricalSync() {
    await this.etlService.triggerOddsHistoricalSync();
    return { status: 'ok' as const };
  }

  @Post('sync/odds-historical/:season')
  async triggerOddsHistoricalSyncForSeason(@Param('season') season: string) {
    const year = Number.parseInt(season, 10);
    if (Number.isNaN(year) || year < 1900 || year > 2100) {
      throw new BadRequestException('season must be a valid year (e.g. 2023)');
    }

    await this.etlService.triggerOddsHistoricalSyncForSeason(year);
    return { status: 'ok' as const, season: year };
  }
}
