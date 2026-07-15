import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Shared body for POST /etl/sync/:type — fields are only read by the sync
// types that need them (date: odds-prematch, analysis; lookbackDays: stale-scheduled).
export class OddsPrematchSyncBodyDto {
  @ApiPropertyOptional({
    description:
      'Target date in ISO format (YYYY-MM-DD). Defaults to tomorrow UTC when omitted. ' +
      'Use this to backfill a specific matchday.',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Only used by the stale-scheduled sync type: how many days back to look for ' +
      'fixtures stuck in SCHEDULED. Defaults to the worker-configured value when omitted.',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  lookbackDays?: number;
}
