import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Market } from '@evcore/db';

export class MarketParamDto {
  @ApiProperty({ enum: Market, enumName: 'Market' })
  @IsEnum(Market)
  market!: Market;
}
