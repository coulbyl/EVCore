import { IsString, Length } from 'class-validator';

export class ConfirmEmailChangeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
