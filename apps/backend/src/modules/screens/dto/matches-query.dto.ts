import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const MATCHES_DAYS = ['yesterday', 'today', 'tomorrow'] as const;
export type MatchesDay = (typeof MATCHES_DAYS)[number];

export class MatchesQueryDto {
  /** Three chips, no calendar: the past lives in Résultats (06 § 1). */
  @IsOptional()
  @IsIn(MATCHES_DAYS)
  day?: MatchesDay;

  /** The team search: filters on either team's name. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  q?: string;

  /** `nextCursor` of the previous page. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}
