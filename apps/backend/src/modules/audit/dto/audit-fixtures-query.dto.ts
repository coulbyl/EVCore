import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class AuditFixturesQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['BET', 'NO_BET'])
  decision?: 'BET' | 'NO_BET';

  @IsOptional()
  @IsIn(['SCHEDULED', 'LIVE', 'FINISHED'])
  status?: string;

  /** Code de compétition (ex: "EPL", "UCL"). */
  @IsOptional()
  @IsString()
  competition?: string;

  @IsOptional()
  @IsIn(['morning', 'noon', 'afternoon', 'evening', 'night'])
  timeSlot?: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
}
