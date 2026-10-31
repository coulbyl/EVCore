import { IsString, MaxLength, MinLength } from 'class-validator';

/** « Mot de passe » in Compte (09 § 5): the current one, then the new one. */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  /** The rules of sign-up (RegisterDto). */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
