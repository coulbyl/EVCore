import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type CouponIndicesCanal =
  | 'VALUE'
  | 'SAFE'
  | 'BTTS'
  | 'DRAW'
  | 'DOMINANT'
  | 'COUPON';

export class CouponIndicesQueryDto {
  @IsIn(['VALUE', 'SAFE', 'BTTS', 'DRAW', 'DOMINANT', 'COUPON'])
  canal: CouponIndicesCanal = 'SAFE';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
