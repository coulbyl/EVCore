import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SubscriptionChannelPickMode,
  SubscriptionSourceType,
} from '@evcore/db';

// 15 = tous les jours de semaine (7) sélectionnables ; pas de plafond côté
// codes de compétition ici (validés contre la table Competition côté service).
const MAX_DAYS_OF_WEEK = 7;

export class CreateSubscriptionDto {
  @IsEnum(SubscriptionSourceType)
  sourceType!: SubscriptionSourceType;

  @IsOptional()
  @IsEnum(SubscriptionChannelPickMode)
  channelPickMode?: SubscriptionChannelPickMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  topN?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  stakePerEvent!: number;

  @IsArray()
  @ArrayMaxSize(MAX_DAYS_OF_WEEK)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsArray()
  @IsString({ each: true })
  competitionCodes!: string[];

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
