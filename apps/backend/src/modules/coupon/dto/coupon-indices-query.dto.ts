import { IsDateString, IsIn, IsOptional } from 'class-validator';
import type { CouponSource } from '@evcore/db';

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

  /** Canal COUPON : restreint à un générateur. */
  @IsOptional()
  @IsIn(['LLM', 'PRICE_COMPOSER'])
  source?: CouponSource;
}
