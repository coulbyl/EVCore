import { IsString, MaxLength } from 'class-validator';

export class MeSettledQueryDto {
  /** `nextCursor` of the previous page. */
  @IsString()
  @MaxLength(64)
  cursor!: string;
}
