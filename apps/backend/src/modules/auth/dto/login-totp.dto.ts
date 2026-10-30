import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class LoginTotpDto {
  /** Rendu par POST /auth/login quand le compte a une application. */
  @IsString()
  @MaxLength(128)
  challenge!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
