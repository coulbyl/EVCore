import { ApiProperty } from '@nestjs/swagger';

export class WeeklyReportResponseDto {
  @ApiProperty({ description: 'ROI 1X2 formatted to 4 decimal places' })
  roiOneXTwo!: string;

  @ApiProperty()
  betsPlaced!: number;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  periodStart!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  periodEnd!: string;
}
