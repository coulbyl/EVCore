import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PredictionChannel } from '@evcore/db';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class PredictionListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  competition?: string;

  @IsOptional()
  @IsEnum(PredictionChannel)
  channel?: PredictionChannel;
}

export class PredictionStatsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsString()
  competition?: string;

  @IsOptional()
  @IsEnum(PredictionChannel)
  channel?: PredictionChannel;
}
