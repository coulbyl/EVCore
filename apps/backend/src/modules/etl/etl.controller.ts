import { Controller, Get, Post } from '@nestjs/common';
import { EtlService } from './etl.service';

@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Get('status')
  getStatus() {
    return this.etlService.getQueueStatus();
  }

  @Post('sync/full')
  async triggerFullSync() {
    await this.etlService.triggerFullSync();
    return { status: 'ok' as const };
  }

  @Post('sync/stats')
  async triggerStatsSync() {
    await this.etlService.triggerStatsSync();
    return { status: 'ok' as const };
  }

  @Post('sync/odds-csv')
  async triggerOddsCsvImport() {
    await this.etlService.triggerOddsCsvImport();
    return { status: 'ok' as const };
  }
}
