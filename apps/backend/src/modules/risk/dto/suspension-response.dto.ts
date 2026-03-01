import { ApiProperty } from '@nestjs/swagger';
import { Market } from '@evcore/db';

export class SuspensionResponseDto {
  @ApiProperty({ enum: Market, enumName: 'Market' })
  market!: Market;

  @ApiProperty()
  suspended!: boolean;
}
