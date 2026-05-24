import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type InvestmentSummaryCanal =
  | 'EV'
  | 'SV'
  | 'BB'
  | 'NUL'
  | 'CONF'
  | 'COUPON';

export class InvestmentSummaryQueryDto {
  @IsIn(['EV', 'SV', 'BB', 'NUL', 'CONF', 'COUPON'])
  canal: InvestmentSummaryCanal = 'SV';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
