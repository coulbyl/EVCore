import { IsIn, IsOptional, IsString, IsUrl, Matches } from 'class-validator';

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
}
