import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  StatsBackfillService,
  type StatsBackfillStatus,
} from './stats-backfill.service';

@ApiTags('ETL')
@Controller('etl/stats-backfill')
export class StatsBackfillController {
  constructor(private readonly statsBackfill: StatsBackfillService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Automatic stats backfill status',
    description:
      'Coverage per season, next seasons in priority order, seasons skipped ' +
      'for low API-Football coverage, and the budget left above the reserve.',
  })
  getStatus(): Promise<StatsBackfillStatus> {
    return this.statsBackfill.getStatus();
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause the automatic stats backfill' })
  async pause(): Promise<{ status: 'paused' }> {
    await this.statsBackfill.pause();
    return { status: 'paused' };
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume the automatic stats backfill' })
  async resume(): Promise<{ status: 'resumed' }> {
    await this.statsBackfill.resume();
    return { status: 'resumed' };
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run one backfill tick now',
    description:
      'Enqueues one tick without waiting for the cron. Same budget and ' +
      'priority rules; a no-op when the budget is spent.',
  })
  async run(): Promise<{ status: 'queued' }> {
    await this.statsBackfill.runNow();
    return { status: 'queued' };
  }
}
