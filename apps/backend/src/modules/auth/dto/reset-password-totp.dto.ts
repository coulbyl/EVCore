import { IsString, Length, MinLength, MaxLength } from 'class-validator';

export class ResetPasswordTotpDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @Length(6, 6)
  totpCode!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
