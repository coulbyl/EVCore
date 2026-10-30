import { AVATAR_PATHS } from '@evcore/analysis-core';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
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

  // Un des avatars servis par l'application (2026-10-28) ; plus d'URL
  // externe. Le badge requis se vérifie dans le service.
  @IsOptional()
  @IsIn(AVATAR_PATHS)
  avatarUrl?: string;

  // Les interrupteurs de Compte › Notifications (09 § 5) : quatre sortes,
  // plus « Par e-mail aussi ».
  @IsOptional()
  @IsBoolean()
  morningBriefEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyStatementEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  followedResultEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  teamRepliesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

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
