import { Controller, Post } from '@nestjs/common';
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
}
