import { IsEnum, IsString, MinLength } from 'class-validator';
import { FormationContentType } from '@evcore/db';

export class UpsertFormationProgressDto {
  @IsEnum(FormationContentType)
  contentType!: FormationContentType;

  @IsString()
  @MinLength(1)
  slug!: string;
}
