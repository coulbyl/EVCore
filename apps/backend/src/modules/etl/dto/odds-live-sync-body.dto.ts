import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OddsLiveSyncBodyDto {
  @ApiPropertyOptional({
    description:
      'Target date in ISO format (YYYY-MM-DD). Defaults to tomorrow UTC when omitted. ' +
      'Use this to backfill a specific matchday.',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
