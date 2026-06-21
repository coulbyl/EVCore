import { IsDateString, IsOptional } from 'class-validator';

export class CouponRoiQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
