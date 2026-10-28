import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
