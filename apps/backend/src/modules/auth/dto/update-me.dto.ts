import { Type } from 'class-transformer';
import type { RiskProfile, UnitMode } from '@evcore/db';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
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

  @IsOptional()
  @IsString()
  @IsIn(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'])
  riskProfile?: RiskProfile;

  @IsOptional()
  @IsBoolean()
  emailSupportNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  hasSeenOnboarding?: boolean;

  @IsOptional()
  @IsBoolean()
  hasCompletedOnboarding?: boolean;

  // Format libre (pas de région imposée — IsPhoneNumber(undefined) accepte
  // n'importe quel indicatif international valide, cf. décision produit
  // 2026-09-04, TODO.md "pas de numéro de téléphone collecté").
  @IsOptional()
  @IsPhoneNumber(undefined)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  phoneNumberConsentGiven?: boolean;
}
