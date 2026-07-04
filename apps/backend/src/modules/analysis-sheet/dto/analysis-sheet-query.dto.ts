import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  ANALYSIS_SHEET_CHANNELS,
  ANALYSIS_SHEET_COUPONS,
} from '../analysis-sheet.constants';

export class AnalysisSheetQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  competitionCode?: string;

  @IsOptional()
  @IsIn(ANALYSIS_SHEET_CHANNELS)
  channel?: (typeof ANALYSIS_SHEET_CHANNELS)[number];

  @IsOptional()
  @IsIn(['txt', 'json'])
  format?: 'txt' | 'json';

  // Net win the user wants the coupon stakes sized for (analyze flow only).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ANALYSIS_SHEET_COUPONS.maxTargetWinAmount)
  targetWinAmount?: number;
}
