import { IsDateString, IsOptional } from 'class-validator';

export class WeekQueryDto {
  /** The week's Monday (YYYY-MM-DD); the last closed week by default. */
  @IsOptional()
  @IsDateString()
  week?: string;
}
