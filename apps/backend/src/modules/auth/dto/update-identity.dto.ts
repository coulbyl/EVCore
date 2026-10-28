import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// L'adresse e-mail ne change plus ici (2026-10-28) : sans mot de passe ni
// code, n'importe quelle session pouvait la remplacer. Elle passe par
// POST /auth/me/email/request puis /confirm. Un champ `email` envoyé ici est
// retiré par la ValidationPipe (whitelist).
export class UpdateIdentityDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres ou _.",
  })
  username?: string;
}
