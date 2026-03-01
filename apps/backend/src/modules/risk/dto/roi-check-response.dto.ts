import { ApiProperty } from '@nestjs/swagger';
import { Market } from '@evcore/db';

export class RoiCheckResponseDto {
  @ApiProperty({ enum: Market, enumName: 'Market' })
  market!: Market;

  @ApiProperty()
  betCount!: number;

  @ApiProperty({ description: 'ROI formatted to 4 decimal places' })
  roi!: string;

  @ApiProperty({ enum: ['suspended', 'alerted', 'ok', 'insufficient_data'] })
  action!: string;
}
