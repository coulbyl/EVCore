import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { COUPON_PROFILES, type CouponProfileName } from '../coupon.constants';

const COUPON_PROFILE_NAMES = Object.keys(
  COUPON_PROFILES,
) as CouponProfileName[];

export class CouponQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  /**
   * Last day (inclusive) of a multi-day fixture window — e.g. `date` Friday,
   * `to` Sunday for a weekend coupon. Defaults to `date` (single day).
   */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(60)
  windowDays?: number;

  /**
   * Risk profile — defaults to the backtested live profile when omitted.
   * LONGSHOT_WEEKEND/LONGSHOT_MIDWEEK are indicative only (not backtested
   * yet, cf. coupon.constants.ts) — for manual experimentation, not
   * scheduled live generation.
   */
  @IsOptional()
  @IsIn(COUPON_PROFILE_NAMES)
  profile?: CouponProfileName;
}
