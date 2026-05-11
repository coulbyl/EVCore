import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CouponQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(60)
  windowDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  oddsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(200)
  oddsMax?: number;
}
