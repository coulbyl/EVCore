import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CouponPeriodQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date (UTC) of the period in YYYY-MM-DD format. Defaults to current UTC week start when omitted.',
    example: '2026-03-09',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'End date (UTC) of the period in YYYY-MM-DD format. Defaults to current UTC week end when omitted.',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Optional free-text filter applied across coupon code, team names, market and pick (case-insensitive partial search).',
    example: 'Arsenal',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @ApiPropertyOptional({
    description: 'Optional status filter on coupon list.',
    enum: ['PENDING', 'WON', 'LOST'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsIn(['PENDING', 'WON', 'LOST'])
  status?: 'PENDING' | 'WON' | 'LOST';
}
