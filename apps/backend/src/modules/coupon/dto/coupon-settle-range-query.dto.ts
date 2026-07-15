import { IsDateString } from 'class-validator';

export class CouponSettleRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
