import { IsInt, IsOptional, Min } from 'class-validator';

export class SetFixtureResultDto {
  @IsInt()
  @Min(0)
  homeScore!: number;

  @IsInt()
  @Min(0)
  awayScore!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  homeHtScore?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  awayHtScore?: number;
}
