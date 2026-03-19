import { IsDateString, IsOptional } from 'class-validator';

export class AuditFixturesQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
