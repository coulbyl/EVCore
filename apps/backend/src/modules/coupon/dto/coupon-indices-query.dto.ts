import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type CouponIndicesCanal =
  | 'EV'
  | 'SAFE'
  | 'BTTS'
  | 'DRAW'
  | 'DOMINANT'
  | 'COUPON';

export class CouponIndicesQueryDto {
  @IsIn(['EV', 'SAFE', 'BTTS', 'DRAW', 'DOMINANT', 'COUPON'])
  canal: CouponIndicesCanal = 'SAFE';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
