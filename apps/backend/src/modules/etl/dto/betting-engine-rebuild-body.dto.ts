import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BettingEngineRebuildBodyDto {
  @ApiPropertyOptional({
    description:
      'Lower bound (inclusive) on fixture scheduledAt, ISO date (YYYY-MM-DD). ' +
      'Omit to rebuild from the earliest fixture of each season.',
    example: '2025-08-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Upper bound (inclusive) on fixture scheduledAt, ISO date (YYYY-MM-DD). ' +
      'Omit to rebuild up to the latest fixture of each season.',
    example: '2025-08-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
