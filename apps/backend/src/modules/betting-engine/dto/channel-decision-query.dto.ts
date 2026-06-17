import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import {
  ChannelDecisionStatus,
  Market,
  ModelRunPhase,
  StrategyChannel,
} from '@evcore/db';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ChannelDecisionListQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  competition?: string;

  @IsOptional()
  @IsEnum(StrategyChannel)
  channel?: StrategyChannel;

  @IsOptional()
  @IsEnum(Market)
  market?: Market;

  @IsOptional()
  @IsEnum(ChannelDecisionStatus)
  status?: ChannelDecisionStatus;

  @IsOptional()
  @IsEnum(ModelRunPhase)
  phase?: ModelRunPhase;
}
