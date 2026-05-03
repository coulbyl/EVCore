import { Type } from 'class-transformer';
import type { UnitMode } from '@evcore/db';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @IsIn(['light', 'dark', 'system'])
  theme?: string;

  @IsOptional()
  @IsString()
  @IsIn(['fr', 'en'])
  locale?: string;

  @IsOptional()
  @IsString()
  @IsIn(['XOF', 'USD', 'EUR'])
  currency?: string;

  @IsOptional()
  @IsUrl()
  @Matches(/^https:\/\/api\.dicebear\.com\//)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['FIXED', 'PCT'])
  unitMode?: UnitMode;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  unitPercent?: number;
}
