import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class FixtureScoringQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['BET', 'NO_BET'])
  decision?: 'BET' | 'NO_BET';

  @IsOptional()
  @IsIn(['SCHEDULED', 'LIVE', 'FINISHED'])
  status?: string;

  /** Code de compétition (ex: "PL", "UCL"). */
  @IsOptional()
  @IsString()
  competition?: string;

  @IsOptional()
  @IsIn(['morning', 'noon', 'afternoon', 'evening', 'night'])
  timeSlot?: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

  @IsOptional()
  @IsIn(['WON', 'LOST', 'PENDING'])
  betStatus?: 'WON' | 'LOST' | 'PENDING';
}
