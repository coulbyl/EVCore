import {
  Equals,
  IsEmail,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  /**
   * Prénom, seul nom demandé (refonte, 11 § 2) : il s'affiche en haut de Moi
   * et dans les e-mails. Rangé dans `fullName`. Plus de nom d'utilisateur à
   * l'inscription : on se connecte avec l'e-mail.
   */
  @IsString()
  @MaxLength(50)
  @Matches(/\S/, { message: 'Indique ton prénom.' })
  firstName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

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
