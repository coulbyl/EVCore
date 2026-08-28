import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ANALYSIS_SHEET_CHANNELS } from '../analysis-sheet.constants';

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
}
