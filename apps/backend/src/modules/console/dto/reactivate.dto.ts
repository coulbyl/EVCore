import { IsString, MaxLength, MinLength } from 'class-validator';

/** Réactiver a suspended market: the reason is required (12-admin.md § 2). */
export class ReactivateMarketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
