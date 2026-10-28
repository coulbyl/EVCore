import {
  Equals,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_.]+$/)
  username!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  /**
   * L'utilisateur confirme avoir l'âge légal (18 ans, 21 au Cameroun, ou
   * plus selon son pays). Refusé tant que ce n'est pas `true` : un service
   * lié aux paris ne crée pas de compte sans cette déclaration (audit du
   * 2026-10-23, P1-1).
   */
  @Equals(true, { message: "Tu dois confirmer avoir l'âge légal pour parier." })
  confirmAge!: boolean;

  /** Conditions d'utilisation et politique de confidentialité acceptées. */
  @Equals(true, {
    message:
      "Tu dois accepter les conditions d'utilisation et la politique de confidentialité.",
  })
  acceptTerms!: boolean;
}
