import { IsBoolean } from 'class-validator';

export class UpdateCompetitionActiveDto {
  @IsBoolean()
  isActive!: boolean;
}
