import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OddsSnapshotRetentionBodyDto {
  @ApiPropertyOptional({
    description:
      'Retention period in days. Overrides ODDS_SNAPSHOT_RETENTION_DAYS for this run only.',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?: number;
}
