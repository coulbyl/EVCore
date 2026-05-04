import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class SummaryQueryDto {
  @IsOptional()
  @IsIn(['EV', 'SV', 'CONF', 'DRAW', 'BTTS'])
  channel?: 'EV' | 'SV' | 'CONF' | 'DRAW' | 'BTTS';

  @IsOptional()
  @IsIn(['7d', '30d', '3m'])
  period?: '7d' | '30d' | '3m';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
