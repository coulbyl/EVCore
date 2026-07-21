import { IsDateString } from 'class-validator';

export class ChannelDecisionSettleRangeQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}
