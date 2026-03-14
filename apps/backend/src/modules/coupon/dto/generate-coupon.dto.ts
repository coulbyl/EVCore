import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  COUPON_WINDOW_MAX_DAYS,
  COUPON_WINDOW_MIN_DAYS,
} from '@config/coupon.constants';

export class GenerateCouponDto {
  @ApiPropertyOptional({
    description:
      'Start date (UTC) for coupon generation in ISO 8601 format (YYYY-MM-DD). ' +
      'Defaults to tomorrow UTC when omitted.',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Number of days to include in the coupon window. ' +
      `Must be between ${COUPON_WINDOW_MIN_DAYS} and ${COUPON_WINDOW_MAX_DAYS}. Defaults to 1.`,
    example: 1,
    minimum: COUPON_WINDOW_MIN_DAYS,
    maximum: COUPON_WINDOW_MAX_DAYS,
  })
  @IsOptional()
  @IsInt()
  @Min(COUPON_WINDOW_MIN_DAYS)
  @Max(COUPON_WINDOW_MAX_DAYS)
  days?: number;
}
