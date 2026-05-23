import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type InvestmentIndicesCanal =
  | 'EV'
  | 'SV'
  | 'BB'
  | 'NUL'
  | 'CONF'
  | 'COUPON';

export class InvestmentIndicesQueryDto {
  @IsIn(['EV', 'SV', 'BB', 'NUL', 'CONF', 'COUPON'])
  canal: InvestmentIndicesCanal = 'SV';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
