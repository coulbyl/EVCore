import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ROLLING_HORIZON_DEFAULTS } from '@config/etl.constants';

export class AnalysisHorizonBodyDto {
  @ApiPropertyOptional({
    description:
      'First day to analyze, expressed as an offset from today (1 = tomorrow). Defaults to 1.',
    example: 1,
    default: ROLLING_HORIZON_DEFAULTS.START_OFFSET_DAYS,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  startOffsetDays?: number;

  @ApiPropertyOptional({
    description:
      'Number of consecutive days to analyze starting from startOffsetDays. Defaults to 4.',
    example: 4,
    default: ROLLING_HORIZON_DEFAULTS.HORIZON_DAYS,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  horizonDays?: number;
}
