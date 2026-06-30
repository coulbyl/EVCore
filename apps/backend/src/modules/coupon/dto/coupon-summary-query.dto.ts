import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type CouponSummaryCanal =
  | 'VALUE'
  | 'SAFE'
  | 'BTTS'
  | 'DRAW'
  | 'DOMINANT'
  | 'COUPON';

export class CouponSummaryQueryDto {
  @IsIn(['VALUE', 'SAFE', 'BTTS', 'DRAW', 'DOMINANT', 'COUPON'])
  canal: CouponSummaryCanal = 'SAFE';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
